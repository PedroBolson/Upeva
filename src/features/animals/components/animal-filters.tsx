import { Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Input, Button } from '@/components/ui'
import type { AnimalFilters } from '../types/animal.types'
import type { Species, Sex, Size } from '@/types/common'

interface AnimalFiltersProps {
  filters: AnimalFilters
  onChange: (filters: AnimalFilters) => void
  total: number
  className?: string
}

type FilterChip<T extends string> = { value: T | undefined; label: string }

const speciesChips: FilterChip<Species>[] = [
  { value: undefined,   label: 'Todos' },
  { value: 'dog',       label: 'Cachorros' },
  { value: 'cat',       label: 'Gatos' },
]

const sexChips: FilterChip<Sex>[] = [
  { value: undefined,   label: 'Qualquer' },
  { value: 'male',      label: 'Macho' },
  { value: 'female',    label: 'Fêmea' },
]

const sizeChips: FilterChip<Size>[] = [
  { value: undefined,   label: 'Qualquer' },
  { value: 'small',     label: 'Pequeno' },
  { value: 'medium',    label: 'Médio' },
  { value: 'large',     label: 'Grande' },
]

function ChipGroup<T extends string>({
  label,
  chips,
  active,
  onSelect,
}: {
  label: string
  chips: FilterChip<T>[]
  active: T | undefined
  onSelect: (v: T | undefined) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onSelect(chip.value)}
            className={cn(
              'px-3 py-1 rounded-full text-sm font-medium transition-all duration-150 border',
              active === chip.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:border-primary hover:text-primary',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function hasActiveFilters(f: AnimalFilters) {
  return !!(f.species || f.sex || f.size || f.search)
}

export function AnimalFilters({ filters, onChange, total, className }: AnimalFiltersProps) {
  const showSizeFilter = !filters.species || filters.species === 'dog'
  const active = hasActiveFilters(filters)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Search */}
      <Input
        placeholder="Buscar por nome..."
        value={filters.search ?? ''}
        onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        leftIcon={<Search size={16} />}
        rightIcon={
          filters.search ? (
            <button
              type="button"
              onClick={() => onChange({ ...filters, search: undefined })}
              aria-label="Limpar busca"
              className="hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          ) : undefined
        }
        aria-label="Buscar animal por nome"
      />

      {/* Filter chips */}
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6 sm:items-start">
        <SlidersHorizontal size={16} className="text-muted-foreground mt-1 shrink-0 hidden sm:block" />

        <div className="flex flex-col gap-4 flex-1">
          <ChipGroup
            label="Espécie"
            chips={speciesChips}
            active={filters.species}
            onSelect={(v) => onChange({ ...filters, species: v, size: v !== 'dog' ? undefined : filters.size })}
          />

          <ChipGroup
            label="Sexo"
            chips={sexChips}
            active={filters.sex}
            onSelect={(v) => onChange({ ...filters, sex: v })}
          />

          {showSizeFilter && (
            <ChipGroup
              label="Porte"
              chips={sizeChips}
              active={filters.size}
              onSelect={(v) => onChange({ ...filters, size: v })}
            />
          )}
        </div>
      </div>

      {/* Result count + clear */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-sm text-muted-foreground">
          {total} {total === 1 ? 'animal encontrado' : 'animais encontrados'}
        </span>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({})}
            className="gap-1.5 text-muted-foreground"
          >
            <X size={13} />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  )
}
