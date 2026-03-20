import { cn } from '@/utils/cn'

export interface RadioOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface RadioGroupProps {
  name: string
  label?: string
  options: RadioOption[]
  value?: string
  onChange?: (value: string) => void
  error?: string
  hint?: string
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

export function RadioGroup({
  name,
  label,
  options,
  value,
  onChange,
  error,
  hint,
  orientation = 'vertical',
  className,
}: RadioGroupProps) {
  return (
    <fieldset className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <legend className="text-sm font-medium text-foreground mb-1">
          {label}
        </legend>
      )}

      <div
        className={cn(
          'flex gap-3',
          orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
        )}
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex items-start gap-3 cursor-pointer',
              opt.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              disabled={opt.disabled}
              onChange={() => onChange?.(opt.value)}
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed',
              )}
            />
            <span className="flex flex-col gap-0.5 select-none">
              <span className="text-sm text-foreground">{opt.label}</span>
              {opt.description && (
                <span className="text-xs text-muted-foreground">
                  {opt.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger mt-0.5">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      )}
    </fieldset>
  )
}
