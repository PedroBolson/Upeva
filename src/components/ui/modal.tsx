import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Button } from './button'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  size?: ModalSize
  className?: string
  children: React.ReactNode
  footer?: React.ReactNode
  closeOnOverlay?: boolean
  closeOnEscape?: boolean
}

const sizeClasses: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-xl',
  full: 'max-w-full mx-4',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  size = 'md',
  className,
  children,
  footer,
  closeOnOverlay = true,
  closeOnEscape = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const dialogTitleId = title ? ariaLabelledBy ?? titleId : ariaLabelledBy
  const dialogDescriptionId = description ? ariaDescribedBy ?? descriptionId : ariaDescribedBy

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = getFocusableElements(dialog)
      const target = focusable[0] ?? dialog
      target.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (prev && document.contains(prev)) prev.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return

      const focusable = getFocusableElements(dialog)
      if (focusable.length === 0) {
        e.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault()
          last.focus()
        }
        return
      }

      if (active === last || !dialog.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [closeOnEscape, open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={closeOnOverlay ? onClose : undefined}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={dialogTitleId ? undefined : ariaLabel}
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescriptionId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl',
              'focus:outline-none',
              sizeClasses[size],
              className,
            )}
          >
            {(title || description) && (
              <div className="flex shrink-0 items-start justify-between gap-4 p-4 pb-0 sm:p-6 sm:pb-0">
                <div className="min-w-0 flex flex-col gap-1">
                  {title && (
                    <h2 id={titleId} className="text-lg font-semibold text-card-foreground">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descriptionId} className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="shrink-0 -mr-2 -mt-2"
                >
                  <X size={18} />
                </Button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>

            {footer && (
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-4 py-3 sm:px-6 sm:py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'))
}
