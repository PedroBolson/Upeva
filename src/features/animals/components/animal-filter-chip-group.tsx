import { cn } from '@/utils/cn'

export type FilterChip<T extends string> = {
  value: T | undefined
  label: string
}

interface AnimalFilterChipGroupProps<T extends string> {
  label: string
  chips: FilterChip<T>[]
  active: T | undefined
  onSelect: (value: T | undefined) => void
}

export function AnimalFilterChipGroup<T extends string>({
  label,
  chips,
  active,
  onSelect,
}: AnimalFilterChipGroupProps<T>) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onSelect(chip.value)}
            className={cn(
              'rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-150',
              active === chip.value
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}
