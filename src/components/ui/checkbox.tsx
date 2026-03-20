import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  error?: string
  hint?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={inputId}
          className="flex items-start gap-3 cursor-pointer group"
        >
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            aria-invalid={error ? 'true' : undefined}
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0 rounded border border-input bg-background',
              'accent-primary cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-danger',
              className,
            )}
            {...props}
          />
          {label && (
            <span className="text-sm text-foreground leading-relaxed select-none">
              {label}
            </span>
          )}
        </label>

        {error && (
          <p role="alert" className="text-xs text-danger ml-7">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-muted-foreground ml-7">{hint}</p>
        )}
      </div>
    )
  },
)

Checkbox.displayName = 'Checkbox'
