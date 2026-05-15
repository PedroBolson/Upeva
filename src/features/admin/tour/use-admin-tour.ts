import { useCallback, useEffect } from 'react'
import { driver } from 'driver.js'
import type { DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import './driver-theme.css'
import { useNavigate } from 'react-router-dom'
import type { Timestamp, UserRole } from '@/types/common'
import { updateCompletedTour } from '@/features/auth/services/auth.service'
import {
  firestoreTourKey,
  getAdminTourConfigs,
  getReviewerTourConfigs,
  isTourCompleted,
  markTourCompletedLocally,
} from './admin-tour'

const MOBILE_BREAKPOINT = 768
const STEP_WAIT_TIMEOUT_MS = 1200
const STABLE_RECT_EPSILON = 0.5
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function findVisibleElement(selector: string): Element | null {
  return Array.from(document.querySelectorAll(selector)).find((element) => {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden'
    )
  }) ?? null
}

function findTourElement(selector: string): Element | null {
  return findVisibleElement(selector) ?? document.querySelector(selector)
}

function isFallbackElement(element: Element | null): boolean {
  return !element || element === document.body || element.id === 'driver-dummy-element'
}

function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function getPopoverElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.driver-popover')
}

function resolveStepElement(step: DriveStep | undefined): Element | null {
  const target = step?.element

  if (!target) return null
  if (typeof target === 'string') return findTourElement(target)
  if (typeof target === 'function') {
    const element = target()
    return isFallbackElement(element) ? null : element
  }

  return target
}

function hasStableRect(element: Element, previousRect: DOMRect | null): { stable: boolean; rect: DOMRect } {
  const rect = element.getBoundingClientRect()
  if (!previousRect) return { stable: false, rect }

  const stable =
    Math.abs(rect.x - previousRect.x) <= STABLE_RECT_EPSILON &&
    Math.abs(rect.y - previousRect.y) <= STABLE_RECT_EPSILON &&
    Math.abs(rect.width - previousRect.width) <= STABLE_RECT_EPSILON &&
    Math.abs(rect.height - previousRect.height) <= STABLE_RECT_EPSILON

  return { stable, rect }
}

function waitForStepReady(
  step: DriveStep | undefined,
  callback: () => void,
  {
    route,
    requireStableRect = false,
    timeoutMs = STEP_WAIT_TIMEOUT_MS,
  }: {
    route?: string | null
    requireStableRect?: boolean
    timeoutMs?: number
  } = {},
): () => void {
  let done = false
  let raf = 0
  let timer = 0
  let observer: MutationObserver | null = null
  let previousRect: DOMRect | null = null
  let stableFrames = 0

  const resolve = () => {
    if (done) return
    done = true
    if (raf) window.cancelAnimationFrame(raf)
    if (timer) window.clearTimeout(timer)
    observer?.disconnect()
    window.requestAnimationFrame(callback)
  }

  const scheduleCheck = () => {
    if (done || raf) return
    raf = window.requestAnimationFrame(checkReady)
  }

  const checkReady = () => {
    raf = 0

    if (route && window.location.pathname !== route) {
      scheduleCheck()
      return
    }

    if (!step?.element) {
      resolve()
      return
    }

    const element = resolveStepElement(step)
    if (!element) {
      return
    }

    if (requireStableRect) {
      const next = hasStableRect(element, previousRect)
      previousRect = next.rect
      stableFrames = next.stable ? stableFrames + 1 : 0

      if (stableFrames < 2) {
        scheduleCheck()
        return
      }
    }

    resolve()
  }

  observer = new MutationObserver(scheduleCheck)
  observer.observe(document.body, { childList: true, subtree: true })

  timer = window.setTimeout(resolve, timeoutMs)
  scheduleCheck()

  return () => {
    done = true
    if (raf) window.cancelAnimationFrame(raf)
    if (timer) window.clearTimeout(timer)
    observer?.disconnect()
  }
}

// Returns true when the focused element is an editable control.
// Used to prevent ArrowRight/Left from advancing the tour while typing.
function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable === true
  )
}

const BLOCKED_INTERACTION_EVENTS = [
  'click',
  'dblclick',
  'contextmenu',
  'pointerdown',
  'pointerup',
  'pointermove',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchmove',
  'touchend',
  'dragstart',
  'drag',
  'drop',
  'wheel',
] as const

// Intercepts interactions that land inside `el` using document-level capture
// listeners, which fire before React's synthetic handlers can dispatch. The tour
// popover lives outside `el`, so its buttons remain clickable.
function blockElementInteraction(el: Element): () => void {
  const handler = (e: Event) => {
    if (el.contains(e.target as Node)) {
      e.stopPropagation()
      e.preventDefault()
    }
  }
  const options = { capture: true, passive: false }

  for (const eventName of BLOCKED_INTERACTION_EVENTS) {
    document.addEventListener(eventName, handler, options)
  }

  return () => {
    for (const eventName of BLOCKED_INTERACTION_EVENTS) {
      document.removeEventListener(eventName, handler, options)
    }
  }
}

export function useAdminTour(
  role: UserRole | undefined,
  onBeforeStart: () => void,
  openSidebar: () => void,
  uid: string | undefined,
  completedTours: Record<string, Timestamp> | undefined,
) {
  const navigate = useNavigate()

  const startTour = useCallback(() => {
    document.body.classList.remove('driver-tour-first-step', 'driver-tour-step-change')
    onBeforeStart()
    navigate('/admin')

    const configs = role === 'admin' ? getAdminTourConfigs() : getReviewerTourConfigs()
    const steps = configs.map((c) => c.step)

    // Compute the route each step is displayed on by replaying navTargets forward.
    // stepRoutes[i] is the pathname that must be active when step i is shown.
    const stepRoutes: string[] = []
    let routeCursor = '/admin'
    for (const config of configs) {
      stepRoutes.push(routeCursor)
      if (config.navTarget) routeCursor = config.navTarget
    }

    const ref: { d: ReturnType<typeof driver> | null } = { d: null }

    // Guards against double-advancement when both the element click listener
    // and the "Avançar" button fire for the same step.
    let isAdvancing = false

    // Cleanup handles for the active click listener, element wait, and interaction blocking.
    let cancelClick: (() => void) | null = null
    let cancelWait: (() => void) | null = null
    let unblockInteraction: (() => void) | null = null
    let cancelViewportWatch: (() => void) | null = null
    let refreshFrame = 0
    let removeKeyboardListener: (() => void) | null = null
    let hasRenderedStep = false
    let isStepChangeRender = false
    let previousPopoverRect: DOMRect | null = null

    function cancelPending() {
      cancelClick?.()
      cancelClick = null
      cancelWait?.()
      cancelWait = null
      unblockInteraction?.()
      unblockInteraction = null
    }

    function scheduleRefresh() {
      if (refreshFrame) return
      refreshFrame = window.requestAnimationFrame(() => {
        refreshFrame = 0
        ref.d?.refresh()
      })
    }

    function startViewportWatch() {
      const scrollRoot = document.getElementById('main-content')
      window.addEventListener('resize', scheduleRefresh)
      window.addEventListener('orientationchange', scheduleRefresh)
      window.visualViewport?.addEventListener('resize', scheduleRefresh)
      scrollRoot?.addEventListener('scroll', scheduleRefresh, { passive: true })

      cancelViewportWatch = () => {
        window.removeEventListener('resize', scheduleRefresh)
        window.removeEventListener('orientationchange', scheduleRefresh)
        window.visualViewport?.removeEventListener('resize', scheduleRefresh)
        scrollRoot?.removeEventListener('scroll', scheduleRefresh)
        if (refreshFrame) window.cancelAnimationFrame(refreshFrame)
        refreshFrame = 0
      }
    }

    function capturePopoverPosition() {
      previousPopoverRect = getPopoverElement()?.getBoundingClientRect() ?? null
    }

    function preparePopoverTransition(wrapper: HTMLElement) {
      if (!isStepChangeRender || !previousPopoverRect || prefersReducedMotion()) return
      wrapper.style.visibility = 'hidden'
    }

    function playPopoverTransition() {
      const popover = getPopoverElement()
      const previousRect = previousPopoverRect
      previousPopoverRect = null

      if (!popover) return

      if (!isStepChangeRender || !previousRect || prefersReducedMotion()) {
        popover.style.visibility = ''
        return
      }

      const nextRect = popover.getBoundingClientRect()
      const dx = previousRect.left - nextRect.left
      const dy = previousRect.top - nextRect.top

      popover.style.visibility = ''

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return

      popover.style.transition = 'none'
      popover.style.translate = `${dx}px ${dy}px`
      popover.style.opacity = '0.96'

      window.requestAnimationFrame(() => {
        popover.style.transition = 'translate 180ms cubic-bezier(0.2, 0, 0.2, 1), opacity 120ms ease-out'
        popover.style.translate = '0 0'
        popover.style.opacity = '1'
      })
    }

    function startKeyboardControls() {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.repeat || isInputFocused()) return

        const i = ref.d?.getActiveIndex()
        if (typeof i !== 'number') return

        if (event.key === 'ArrowRight') {
          event.preventDefault()
          advance(i, 'button')
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          advanceBack(i)
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      removeKeyboardListener = () => window.removeEventListener('keydown', handleKeyDown)
    }

    // Core advancement: navigate (if needed) then wait for the next element,
    // then call moveNext(). source='click' means the real UI element was already
    // clicked (React Router handled navigation) — we skip re-navigating.
    function advance(currentIndex: number, source: 'click' | 'button') {
      if (isAdvancing) return
      isAdvancing = true
      cancelPending()

      const config = configs[currentIndex]
      const navTarget = config?.navTarget
      const nextConfig = configs[currentIndex + 1]

      const doMove = () => {
        isAdvancing = false
        capturePopoverPosition()
        ref.d?.moveNext()
      }

      const waitAndMove = (route?: string | null, requireStableRect = false) => {
        cancelWait = waitForStepReady(nextConfig?.step, doMove, { route, requireStableRect })
      }

      if (navTarget) {
        // "button" path: we navigate; "click" path: React Router already did it.
        if (source === 'button') navigate(navTarget)

        if (nextConfig?.opensNavOnMobile && window.innerWidth < MOBILE_BREAKPOINT) {
          cancelWait = waitForStepReady(undefined, () => {
            openSidebar()
            waitAndMove(null, true)
          }, { route: navTarget })
        } else {
          waitAndMove(navTarget)
        }
      } else {
        if (nextConfig?.opensNavOnMobile && window.innerWidth < MOBILE_BREAKPOINT) {
          openSidebar()
          waitAndMove(null, true)
        } else {
          waitAndMove()
        }
      }
    }

    // Back navigation: navigate to the previous step's route when needed,
    // wait for its element, then call movePrevious().
    function advanceBack(currentIndex: number) {
      if (isAdvancing) return
      isAdvancing = true
      cancelPending()

      const prevIndex = currentIndex - 1
      if (prevIndex < 0) {
        isAdvancing = false
        return
      }

      const prevConfig = configs[prevIndex]

      const doMovePrev = () => {
        isAdvancing = false
        capturePopoverPosition()
        ref.d?.movePrevious()
      }

      const waitAndMovePrev = (route?: string | null, requireStableRect = false) => {
        cancelWait = waitForStepReady(prevConfig.step, doMovePrev, { route, requireStableRect })
      }

      const targetRoute = stepRoutes[prevIndex]
      if (targetRoute && targetRoute !== window.location.pathname) {
        navigate(targetRoute)

        if (prevConfig.opensNavOnMobile && window.innerWidth < MOBILE_BREAKPOINT) {
          cancelWait = waitForStepReady(undefined, () => {
            openSidebar()
            waitAndMovePrev(null, true)
          }, { route: targetRoute })
        } else {
          waitAndMovePrev(targetRoute)
        }
      } else {
        if (prevConfig.opensNavOnMobile && window.innerWidth < MOBILE_BREAKPOINT) {
          openSidebar()
          waitAndMovePrev(null, true)
        } else {
          waitAndMovePrev()
        }
      }
    }

    window.requestAnimationFrame(() => {
      ref.d = driver({
        animate: false,
        allowKeyboardControl: false,
        smoothScroll: false,
        stagePadding: 8,
        stageRadius: 6,
        showProgress: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Avançar',
        prevBtnText: 'Voltar',
        doneBtnText: 'Concluir',
        allowClose: true,
        overlayClickBehavior: () => {},

        onDestroyed: () => {
          cancelPending()
          cancelViewportWatch?.()
          cancelViewportWatch = null
          removeKeyboardListener?.()
          removeKeyboardListener = null
          document.body.classList.remove('driver-tour-first-step', 'driver-tour-step-change')
          previousPopoverRect = null
          if (!role) return
          markTourCompletedLocally(role)
          if (uid) {
            void updateCompletedTour(uid, firestoreTourKey(role)).catch(() => {})
          }
        },

        // Called when a step's element begins highlighting.
        // Attaches a click listener on interactive (clickAdvances) elements
        // and blocks inner links on list area steps.
        onHighlightStarted: (element, _step, { state }) => {
          // Reset so the next step can advance freely.
          isAdvancing = false
          cancelClick?.()
          cancelClick = null
          unblockInteraction?.()
          unblockInteraction = null

          const i = state.activeIndex ?? 0
          const config = configs[i]
          const isFirstStepRender = !hasRenderedStep
          isStepChangeRender = !isFirstStepRender
          document.body.classList.toggle('driver-tour-first-step', isFirstStepRender)
          document.body.classList.toggle('driver-tour-step-change', isStepChangeRender)
          hasRenderedStep = true

          if (element instanceof Element && config?.allowInteraction !== true) {
            unblockInteraction = blockElementInteraction(element)
          }

          if (config?.clickAdvances && element instanceof Element) {
            let fired = false
            const useCapture = Boolean(config.opensSidebarOnMobileClick && window.innerWidth < MOBILE_BREAKPOINT)
            const handler = (event: Event) => {
              if (fired) return
              fired = true
              if (useCapture) {
                event.preventDefault()
                event.stopPropagation()
                openSidebar()
              }
              cancelClick = null
              advance(i, 'click')
            }
            element.addEventListener('click', handler, { capture: useCapture, once: true })
            cancelClick = () => element.removeEventListener('click', handler, { capture: useCapture })
          }
        },

        onPopoverRender: (popover) => {
          preparePopoverTransition(popover.wrapper)
        },

        onHighlighted: () => {
          playPopoverTransition()
        },

        // Called by the "Próximo/Concluir" button AND by ArrowRight keyboard.
        onNextClick: (_el, _step, { state }) => {
          if (isInputFocused()) return
          const i = state.activeIndex ?? 0
          advance(i, 'button')
        },

        // Called by the "Voltar" button AND by ArrowLeft keyboard.
        onPrevClick: (_el, _step, { state }) => {
          if (isInputFocused()) return
          const i = state.activeIndex ?? 0
          advanceBack(i)
        },

        steps,
      })

      startViewportWatch()
      startKeyboardControls()
      ref.d.drive()
    })
  }, [role, onBeforeStart, openSidebar, navigate, uid])

  // Auto-start once per role+version if not yet completed.
  useEffect(() => {
    if (isTourCompleted(role, completedTours)) return
    const frame = window.requestAnimationFrame(() => startTour())
    return () => window.cancelAnimationFrame(frame)
    // completedTours is loaded once from Firestore at login and is stable for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, completedTours])

  return { startTour }
}
