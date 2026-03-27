import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  name?: string
  required?: boolean
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      hint,
      options,
      placeholder,
      id,
      value,
      defaultValue,
      onChange,
      onBlur,
      disabled,
      required,
      name,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-') ?? `select-${generatedId}`
    const rootRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    const [internalValue, setInternalValue] = useState(defaultValue ?? '')
    const [menuPosition, setMenuPosition] = useState<{
      left: number
      width: number
      top?: number
      bottom?: number
      maxHeight: number
      placement: 'top' | 'bottom'
    } | null>(null)
    const selectedValue = value ?? internalValue
    const selectedOption = useMemo(
      () => options.find((option) => option.value === selectedValue),
      [options, selectedValue],
    )
    const firstEnabledIndex = useMemo(
      () => options.findIndex((option) => !option.disabled),
      [options],
    )
    const [highlightedIndex, setHighlightedIndex] = useState(firstEnabledIndex)

    const getInitialHighlightedIndex = () => {
      const selectedIndex = options.findIndex(
        (option) => option.value === selectedValue && !option.disabled,
      )
      return selectedIndex >= 0 ? selectedIndex : firstEnabledIndex
    }

    const findNextEnabledIndex = (startIndex: number, direction: 1 | -1) => {
      if (options.length === 0) return -1

      let nextIndex = startIndex >= 0 ? startIndex : firstEnabledIndex
      for (let offset = 0; offset < options.length; offset += 1) {
        nextIndex = (nextIndex + direction + options.length) % options.length
        if (!options[nextIndex]?.disabled) {
          return nextIndex
        }
      }

      return startIndex
    }

    const openMenu = (index = getInitialHighlightedIndex()) => {
      const triggerRect = triggerRef.current?.getBoundingClientRect()
      if (!triggerRect) return

      const viewportPadding = 8
      const offset = 8
      const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding
      const availableAbove = triggerRect.top - viewportPadding
      const placement: 'top' | 'bottom' =
        availableBelow < 220 && availableAbove > availableBelow ? 'top' : 'bottom'

      setHighlightedIndex(index)
      setMenuPosition({
        left: Math.max(viewportPadding, triggerRect.left),
        width: triggerRect.width,
        top: placement === 'bottom' ? triggerRect.bottom + offset : undefined,
        bottom: placement === 'top' ? window.innerHeight - triggerRect.top + offset : undefined,
        maxHeight: Math.max(160, placement === 'bottom' ? availableBelow : availableAbove),
        placement,
      })
      setOpen(true)
    }

    useEffect(() => {
      if (!open) return

      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node
        if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
          setOpen(false)
          setMenuPosition(null)
          onBlur?.()
        }
      }

      const handleFocusIn = (event: FocusEvent) => {
        const target = event.target as Node
        if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
          setOpen(false)
          setMenuPosition(null)
          onBlur?.()
        }
      }

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setOpen(false)
          setMenuPosition(null)
          onBlur?.()
        }
      }

      const handleViewportChange = () => {
        setOpen(false)
        setMenuPosition(null)
      }

      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('focusin', handleFocusIn)
      document.addEventListener('keydown', handleEscape)
      window.addEventListener('resize', handleViewportChange)
      window.addEventListener('scroll', handleViewportChange, true)

      return () => {
        document.removeEventListener('mousedown', handlePointerDown)
        document.removeEventListener('focusin', handleFocusIn)
        document.removeEventListener('keydown', handleEscape)
        window.removeEventListener('resize', handleViewportChange)
        window.removeEventListener('scroll', handleViewportChange, true)
      }
    }, [open, onBlur])

    const selectValue = (nextValue: string) => {
      if (value === undefined) {
        setInternalValue(nextValue)
      }
      onChange?.(nextValue)
      onBlur?.()
      setOpen(false)
      setMenuPosition(null)
    }

    const moveHighlight = (direction: 1 | -1) => {
      if (options.length === 0) return

      setHighlightedIndex((current) => findNextEnabledIndex(current, direction))
    }

    const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (open) {
          const option = options[highlightedIndex]
          if (option && !option.disabled) selectValue(option.value)
        } else {
          openMenu()
        }
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (!open) {
          openMenu(findNextEnabledIndex(getInitialHighlightedIndex(), 1))
        } else {
          moveHighlight(1)
        }
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (!open) {
          openMenu(findNextEnabledIndex(getInitialHighlightedIndex(), -1))
        } else {
          moveHighlight(-1)
        }
        return
      }

      if (event.key === 'Tab') {
        setOpen(false)
        setMenuPosition(null)
        onBlur?.()
      }
    }

    return (
      <div ref={rootRef} className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            {label}
            {required && (
              <span className="text-danger ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}

        <div className="relative">
          <button
            ref={(node) => {
              triggerRef.current = node
              if (typeof ref === 'function') {
                ref(node)
              } else if (ref) {
                ref.current = node
              }
            }}
            id={inputId}
            type="button"
            name={name}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={`${inputId}-listbox`}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            onClick={() => {
              if (disabled) return
              if (open) {
                setOpen(false)
                setMenuPosition(null)
                onBlur?.()
              } else {
                openMenu()
              }
            }}
            onKeyDown={handleTriggerKeyDown}
            className={cn(
              'flex w-full items-center justify-between rounded-md border border-input bg-background text-left text-foreground',
              'px-3 py-2 pr-9 text-sm',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-danger focus:ring-danger',
              className,
            )}
            {...props}
          >
            <span className={cn(!selectedOption && 'text-muted-foreground')}>
              {selectedOption?.label ?? placeholder ?? 'Selecione…'}
            </span>
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <ChevronDown size={16} />
            </motion.span>
          </button>

        </div>

        {typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {open && menuPosition && (
                <motion.div
                  ref={menuRef}
                  initial={{
                    opacity: 0,
                    y: menuPosition.placement === 'bottom' ? -6 : 6,
                    scale: 0.98,
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    y: menuPosition.placement === 'bottom' ? -4 : 4,
                    scale: 0.98,
                  }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  style={{
                    position: 'fixed',
                    left: menuPosition.left,
                    width: menuPosition.width,
                    top: menuPosition.top,
                    bottom: menuPosition.bottom,
                    zIndex: 9999,
                  }}
                  className="overflow-hidden rounded-xl border border-border bg-background shadow-xl shadow-foreground/10"
                >
                  <ul
                    id={`${inputId}-listbox`}
                    role="listbox"
                    aria-labelledby={label ? inputId : undefined}
                    className="overflow-y-auto p-1"
                    style={{ maxHeight: menuPosition.maxHeight }}
                  >
                    {options.map((option, index) => {
                      const isSelected = option.value === selectedValue
                      const isHighlighted = index === highlightedIndex

                      return (
                        <li key={option.value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            disabled={option.disabled}
                            onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                            onClick={() => !option.disabled && selectValue(option.value)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                              option.disabled && 'cursor-not-allowed opacity-50',
                              !option.disabled && isHighlighted && 'bg-muted text-foreground',
                              !option.disabled && !isHighlighted && 'text-foreground hover:bg-muted/70',
                            )}
                          >
                            <span>{option.label}</span>
                            {isSelected && <Check size={14} className="text-primary" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}

        <AnimatePresence initial={false}>
          {error ? (
            <motion.p
              key="error"
              id={`${inputId}-error`}
              role="alert"
              initial={{ opacity: 0, height: 0, marginTop: -4 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden text-xs text-danger"
            >
              {error}
            </motion.p>
          ) : hint ? (
            <motion.p
              key="hint"
              id={`${inputId}-hint`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden text-xs text-muted-foreground"
            >
              {hint}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    )
  },
)

Select.displayName = 'Select'
