import { useCallback, useLayoutEffect, useState } from 'react'

export function useHeaderCompaction() {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const [measureEl, setMeasureEl] = useState<HTMLDivElement | null>(null)
  const [isCompact, setIsCompact] = useState(false)

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    setContainerEl(el)
    if (!el) setIsCompact(false)
  }, [])

  const measureRef = useCallback((el: HTMLDivElement | null) => {
    setMeasureEl(el)
    if (!el) setIsCompact(false)
  }, [])

  useLayoutEffect(() => {
    if (!containerEl || !measureEl) return

    const update = () => {
      setIsCompact(measureEl.scrollWidth > containerEl.clientWidth + 1)
    }

    const frameId = requestAnimationFrame(update)

    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(containerEl)
    resizeObserver.observe(measureEl)

    const mutationObserver = new MutationObserver(update)
    mutationObserver.observe(measureEl, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    })

    window.addEventListener('resize', update)

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [containerEl, measureEl])

  return { containerRef, measureRef, isCompact }
}
