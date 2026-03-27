import { cn } from '@/utils/cn'

export interface TabOption<T extends string = string> {
  value: T
  label: string
  count?: number
}

export interface TabGroupProps<T extends string = string> {
  options: TabOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function TabGroup<T extends string = string>({
  options,
  value,
  onChange,
  className,
}: TabGroupProps<T>) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-1 overflow-x-auto', className)}
    >
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onChange(opt.value)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
