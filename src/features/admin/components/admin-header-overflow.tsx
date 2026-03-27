import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'

interface AdminHeaderOverflowProps {
  label?: string
  active?: boolean
  className?: string
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
}

export function AdminHeaderOverflow({
  label = 'Filtros',
  active = false,
  className,
  children,
}: AdminHeaderOverflowProps) {
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const close = () => setOpen(false)
  const content = typeof children === 'function' ? children(close) : children

  const setDropdownRef = useCallback((node: HTMLDivElement | null) => {
    dropdownRef.current = node

    if (!node) {
      setOffset(0)
      return
    }

    const rect = node.getBoundingClientRect()
    const overflowRight = rect.right - (window.innerWidth - 8)
    const overflowLeft = 8 - rect.left
    if (overflowRight > 0) setOffset(-overflowRight)
    else if (overflowLeft > 0) setOffset(overflowLeft)
    else setOffset(0)
  }, [])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'h-9 shrink-0 gap-1.5 whitespace-nowrap rounded-lg px-3',
          active && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
          className,
        )}
      >
        <span>{label}</span>
        <ChevronDown
          size={14}
          className={cn('transition-transform duration-150', open && 'rotate-180')}
        />
      </Button>

      {open && (
        <div
          ref={setDropdownRef}
          role="menu"
          style={offset !== 0 ? { transform: `translateX(${offset}px)` } : undefined}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-border bg-card p-3 shadow-xl"
        >
          <div className="flex flex-col gap-3">
            {content}
          </div>
        </div>
      )}
    </div>
  )
}
