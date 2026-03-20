import { Badge, Button } from '@/components/ui'
import type { AnimalFilters } from '../types/animal.types'

interface AnimalFilterSummaryProps {
  filters: AnimalFilters
  total: number
  onClear: () => void
}

function buildActiveFilters(filters: AnimalFilters) {
  const items: string[] = []

  if (filters.search) items.push(`Busca: ${filters.search}`)
  if (filters.species) items.push(filters.species === 'dog' ? 'Cachorros' : 'Gatos')
  if (filters.sex) items.push(filters.sex === 'male' ? 'Macho' : 'Fêmea')
  if (filters.size) {
    const sizeLabel = {
      small: 'Porte pequeno',
      medium: 'Porte médio',
      large: 'Porte grande',
    }[filters.size]

    items.push(sizeLabel)
  }

  return items
}

export function AnimalFilterSummary({
  filters,
  total,
  onClear,
}: AnimalFilterSummaryProps) {
  const activeFilters = buildActiveFilters(filters)

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {total} {total === 1 ? 'animal encontrado' : 'animais encontrados'}
          </span>
          <span className="text-xs text-muted-foreground">
            Ajuste a busca e combine os filtros para refinar a lista.
          </span>
        </div>

        {activeFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-9 rounded-full px-4 text-muted-foreground"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((item) => (
            <Badge key={item} variant="outline" className="rounded-full px-3 py-1 text-xs">
              {item}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
