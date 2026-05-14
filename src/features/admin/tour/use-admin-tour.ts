import { useCallback, useEffect } from 'react'
import { driver } from 'driver.js'
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

// Waits for a CSS selector to appear in the DOM, then calls callback.
// Returns a cleanup function that cancels the watch.
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

function waitForElement(
  selector: string,
  callback: () => void,
  timeoutMs = 3000,
): () => void {
  // Element already present — fire on next tick so driver has settled
  if (findTourElement(selector)) {
    const t = setTimeout(callback, 60)
    return () => clearTimeout(t)
  }

  let done = false

  const resolve = () => {
    if (done) return
    done = true
    observer.disconnect()
    clearTimeout(timer)
    callback()
  }

  const observer = new MutationObserver(() => {
    if (findTourElement(selector)) resolve()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // Fallback: proceed even if element never appears (e.g. empty list, mobile)
  const timer = setTimeout(resolve, timeoutMs)

  return () => {
    done = true
    observer.disconnect()
    clearTimeout(timer)
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

// Intercepts clicks that land inside `el` using a document-level capture listener,
// which fires before React's synthetic onClick can dispatch.
// The tour popover lives outside `el` so tour buttons are unaffected.
function blockElementClicks(el: Element): () => void {
  const handler = (e: Event) => {
    if (el.contains(e.target as Node)) {
      e.stopPropagation()
      e.preventDefault()
    }
  }
  document.addEventListener('click', handler, true)
  return () => document.removeEventListener('click', handler, true)
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

    // Cleanup handles for the active click listener, element wait, and link blocking.
    let cancelClick: (() => void) | null = null
    let cancelWait: (() => void) | null = null
    let unblockLinks: (() => void) | null = null
    let cancelViewportWatch: (() => void) | null = null
    let refreshTimer: number | null = null

    function cancelPending() {
      cancelClick?.()
      cancelClick = null
      cancelWait?.()
      cancelWait = null
      unblockLinks?.()
      unblockLinks = null
    }

    function queueRefresh(delay = 120) {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        ref.d?.refresh()
      }, delay)
    }

    function startViewportWatch() {
      const handleViewportChange = () => queueRefresh(160)
      window.addEventListener('resize', handleViewportChange)
      window.addEventListener('orientationchange', handleViewportChange)
      window.visualViewport?.addEventListener('resize', handleViewportChange)

      cancelViewportWatch = () => {
        window.removeEventListener('resize', handleViewportChange)
        window.removeEventListener('orientationchange', handleViewportChange)
        window.visualViewport?.removeEventListener('resize', handleViewportChange)
        if (refreshTimer !== null) {
          window.clearTimeout(refreshTimer)
          refreshTimer = null
        }
      }
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
      const nextEl = nextConfig?.step.element
      const nextSelector = typeof nextEl === 'string' ? nextEl : null

      const doMove = () => {
        isAdvancing = false
        ref.d?.moveNext()
        queueRefresh()
      }

      const waitAndMove = () => {
        if (nextSelector) {
          cancelWait = waitForElement(nextSelector, doMove)
        } else {
          const t = setTimeout(doMove, 400)
          cancelWait = () => clearTimeout(t)
        }
      }

      if (navTarget) {
        // "button" path: we navigate; "click" path: React Router already did it.
        if (source === 'button') navigate(navTarget)

        if (nextConfig?.opensNavOnMobile && window.innerWidth < 768) {
          // After navigate, closeSidebar fires. Open sidebar then wait a fixed 400ms —
          // enough for React commit + 200ms Framer Motion animation + buffer.
          // We skip waitForElement because the MutationObserver fires the instant the
          // element enters the DOM (before the animation starts), causing driver.js to
          // measure the element while it is still off-screen at translateX(-240px).
          const t1 = setTimeout(() => {
            openSidebar()
            const t2 = setTimeout(doMove, 400)
            cancelWait = () => clearTimeout(t2)
          }, 200)
          cancelWait = () => clearTimeout(t1)
        } else {
          waitAndMove()
        }
      } else {
        // No navigation. If the next step needs the sidebar open, open it and wait
        // 400ms (React commit + 200ms animation + buffer) before calling moveNext so
        // driver.js measures the correct on-screen position, not the mid-animation one.
        if (nextConfig?.opensNavOnMobile && window.innerWidth < 768) {
          openSidebar()
          const t = setTimeout(doMove, 400)
          cancelWait = () => clearTimeout(t)
        } else {
          doMove()
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
      const prevEl = prevConfig.step.element
      const prevSelector = typeof prevEl === 'string' ? prevEl : null

      const doMovePrev = () => {
        isAdvancing = false
        ref.d?.movePrevious()
        queueRefresh()
      }

      const waitAndMovePrev = () => {
        if (prevSelector) {
          cancelWait = waitForElement(prevSelector, doMovePrev)
        } else {
          const t = setTimeout(doMovePrev, 400)
          cancelWait = () => clearTimeout(t)
        }
      }

      const targetRoute = stepRoutes[prevIndex]
      if (targetRoute && targetRoute !== window.location.pathname) {
        navigate(targetRoute)

        if (prevConfig.opensNavOnMobile && window.innerWidth < 768) {
          const t1 = setTimeout(() => {
            openSidebar()
            const t2 = setTimeout(doMovePrev, 400)
            cancelWait = () => clearTimeout(t2)
          }, 200)
          cancelWait = () => clearTimeout(t1)
        } else {
          waitAndMovePrev()
        }
      } else {
        if (prevConfig.opensNavOnMobile && window.innerWidth < 768) {
          openSidebar()
          const t = setTimeout(doMovePrev, 400)
          cancelWait = () => clearTimeout(t)
        } else {
          doMovePrev()
        }
      }
    }

    setTimeout(() => {
      ref.d = driver({
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
          unblockLinks?.()
          unblockLinks = null

          const i = state.activeIndex ?? 0
          const config = configs[i]

          if (config?.blockInnerLinks && element instanceof Element) {
            unblockLinks = blockElementClicks(element)
          }

          if (config?.clickAdvances && element instanceof Element) {
            let fired = false
            const useCapture = Boolean(config.opensSidebarOnMobileClick && window.innerWidth < 768)
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

          queueRefresh(80)
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
      ref.d.drive()
    }, 400)
  }, [role, onBeforeStart, openSidebar, navigate, uid])

  // Auto-start once per role+version if not yet completed.
  useEffect(() => {
    if (isTourCompleted(role, completedTours)) return
    const timer = setTimeout(() => startTour(), 900)
    return () => clearTimeout(timer)
    // completedTours is loaded once from Firestore at login and is stable for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, completedTours])

  return { startTour }
}
