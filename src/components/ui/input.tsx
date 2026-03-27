import { forwardRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            {label}
            {props.required && (
              <span className="text-danger ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-muted-foreground pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={cn(
              'w-full rounded-md border border-input bg-background text-foreground',
              'px-3 py-2 text-sm placeholder:text-muted-foreground',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'read-only:bg-muted/50 read-only:cursor-default read-only:focus:ring-0 read-only:focus:border-input',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error && 'border-danger focus:ring-danger',
              className,
            )}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 flex items-center text-muted-foreground">
              {rightIcon}
            </span>
          )}
        </div>

        <AnimatePresence initial={false}>
          {error ? (
            <motion.p
              key="error"
              id={`${inputId}-error`}
              role="alert"
              initial={{ opacity: 0, height: 0, marginTop: -4 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
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
              transition={{ duration: 0.2, ease: 'easeOut' }}
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

Input.displayName = 'Input'
