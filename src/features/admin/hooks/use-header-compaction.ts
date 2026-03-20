import { useCallback, useLayoutEffect, useState } from 'react'

export function useHeaderCompaction() {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const [measureEl, setMeasureEl] = useState<HTMLDivElement | null>(null)
  const [isCompact, setIsCompact] = useState(false)

  const containerRef = useCallback((el: HTMLDivElement | null) => setContainerEl(el), [])
  const measureRef = useCallback((el: HTMLDivElement | null) => setMeasureEl(el), [])

  useLayoutEffect(() => {
    if (!containerEl || !measureEl) {
      setIsCompact(false)
      return
    }

    const update = () => {
      setIsCompact(measureEl.scrollWidth > containerEl.clientWidth + 1)
    }

    update()

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
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [containerEl, measureEl])

  return { containerRef, measureRef, isCompact }
}
