import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { AnimalFilters } from '../types/animal.types'
import type { Species, Sex, Size } from '@/types/common'
import { AnimalFilterChipGroup, type FilterChip } from './animal-filter-chip-group'
import { AnimalFilterSearchField } from './animal-filter-search-field'
import { AnimalFilterSummary } from './animal-filter-summary'

interface AnimalFiltersProps {
  filters: AnimalFilters
  onChange: (filters: AnimalFilters) => void
  total: number
  className?: string
}

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

export function AnimalFilters({ filters, onChange, total, className }: AnimalFiltersProps) {
  const showSizeFilter = !filters.species || filters.species === 'dog'

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <SlidersHorizontal size={13} />
            Busca inteligente
          </div>
          <h2 className="mt-3 text-lg font-semibold text-foreground">
            Encontre o companheiro com o perfil certo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pesquise pelo nome e combine filtros de espécie, sexo e porte.
          </p>
        </div>

        <div className="w-full lg:max-w-sm">
          <AnimalFilterSearchField
            value={filters.search ?? ''}
            onChange={(value) => onChange({ ...filters, search: value })}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AnimalFilterChipGroup
          label="Espécie"
          chips={speciesChips}
          active={filters.species}
          onSelect={(v) => onChange({ ...filters, species: v, size: v !== 'dog' ? undefined : filters.size })}
        />

        <AnimalFilterChipGroup
          label="Sexo"
          chips={sexChips}
          active={filters.sex}
          onSelect={(v) => onChange({ ...filters, sex: v })}
        />

        <div className={cn(!showSizeFilter && 'pointer-events-none opacity-55')}>
          <AnimalFilterChipGroup
            label="Porte"
            chips={sizeChips}
            active={filters.size}
            onSelect={(v) => onChange({ ...filters, size: v })}
          />
          {!showSizeFilter && (
            <p className="mt-2 text-xs text-muted-foreground">
              O porte aparece para cachorros.
            </p>
          )}
        </div>
      </div>

      <AnimalFilterSummary
        filters={filters}
        total={total}
        onClear={() => onChange({})}
      />
    </div>
  )
}
