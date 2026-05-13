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
function waitForElement(
  selector: string,
  callback: () => void,
  timeoutMs = 3000,
): () => void {
  // Element already present — fire on next tick so driver has settled
  if (document.querySelector(selector)) {
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
    if (document.querySelector(selector)) resolve()
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

export function useAdminTour(
  role: UserRole | undefined,
  onBeforeStart: () => void,
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

    // Cleanup handles for the active click listener and element wait.
    let cancelClick: (() => void) | null = null
    let cancelWait: (() => void) | null = null

    function cancelPending() {
      cancelClick?.()
      cancelClick = null
      cancelWait?.()
      cancelWait = null
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

      const doMove = () => {
        isAdvancing = false
        ref.d?.moveNext()
      }

      if (navTarget) {
        // "button" path: we navigate; "click" path: React Router already did it.
        if (source === 'button') navigate(navTarget)

        // Determine what the next step needs in the DOM.
        const nextEl = configs[currentIndex + 1]?.step.element
        const nextSelector = typeof nextEl === 'string' ? nextEl : null

        if (nextSelector) {
          cancelWait = waitForElement(nextSelector, doMove)
        } else {
          // No specific element to wait for — short delay for React to settle.
          const t = setTimeout(doMove, 400)
          cancelWait = () => clearTimeout(t)
        }
      } else {
        doMove()
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

      const doMovePrev = () => {
        isAdvancing = false
        ref.d?.movePrevious()
      }

      const targetRoute = stepRoutes[prevIndex]
      if (targetRoute && targetRoute !== window.location.pathname) {
        navigate(targetRoute)
        const prevEl = configs[prevIndex].step.element
        const prevSelector = typeof prevEl === 'string' ? prevEl : null
        if (prevSelector) {
          cancelWait = waitForElement(prevSelector, doMovePrev)
        } else {
          const t = setTimeout(doMovePrev, 400)
          cancelWait = () => clearTimeout(t)
        }
      } else {
        doMovePrev()
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
          if (!role) return
          markTourCompletedLocally(role)
          if (uid) {
            void updateCompletedTour(uid, firestoreTourKey(role)).catch(() => {})
          }
        },

        // Called when a step's element begins highlighting.
        // Attaches a click listener on interactive (clickAdvances) elements.
        onHighlightStarted: (element, _step, { state }) => {
          // Reset so the next step can advance freely.
          isAdvancing = false
          cancelClick?.()
          cancelClick = null

          const i = state.activeIndex ?? 0
          const config = configs[i]

          if (config?.clickAdvances && element instanceof Element) {
            let fired = false
            const handler = () => {
              if (fired) return
              fired = true
              cancelClick = null
              advance(i, 'click')
            }
            element.addEventListener('click', handler, { once: true })
            cancelClick = () => element.removeEventListener('click', handler)
          }
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

      ref.d.drive()
    }, 400)
  }, [role, onBeforeStart, navigate, uid])

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
