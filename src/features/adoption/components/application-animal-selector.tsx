import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Badge, Button, Input } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'
import { SEX_LABELS, SIZE_LABELS, SPECIES_LABELS, type Animal } from '@/features/animals/types/animal.types'
import type { Sex, Size, Species } from '@/types/common'

type RankedAnimalBadge = 'Compatível' | 'Mesma espécie' | 'Espécie diferente'
type GroupTitle = 'Mais compatíveis' | 'Outros da mesma espécie' | 'Animais de outra espécie'

const DEFAULT_GROUP_VISIBLE_LIMIT = 5
const SEARCH_GROUP_VISIBLE_LIMIT = 25

export type RankedAnimal = {
  animal: Animal
  score: number
  badge: RankedAnimalBadge
  speciesChanged: boolean
}

export type RankedAnimalGroup = {
  title: GroupTitle
  animals: RankedAnimal[]
}

type ApplicationAnimalSelectorProps = {
  species: Species
  preferredSex?: Sex | 'any'
  preferredSize?: Size | 'any'
  sameSpeciesAnimals: Animal[]
  differentSpeciesAnimals: Animal[]
  search: string
  selectedAnimalId?: string
  currentAnimalName?: string
  loadingSameSpecies?: boolean
  loadingDifferentSpecies?: boolean
  hasMoreSameSpecies?: boolean
  hasMoreDifferentSpecies?: boolean
  fetchingMoreSameSpecies?: boolean
  fetchingMoreDifferentSpecies?: boolean
  differentSpeciesVisible: boolean
  onSearchChange: (value: string) => void
  onLoadMoreSameSpecies?: () => void
  onLoadMoreDifferentSpecies?: () => void
  onShowDifferentSpecies: () => void
  onSelectAnimal: (animal: Animal) => void
}

function scoreAnimal(
  animal: Animal,
  species: Species,
  preferredSex?: Sex | 'any',
  preferredSize?: Size | 'any',
): number {
  if (animal.species !== species) return 0

  let score = 1
  if (!preferredSex || preferredSex === 'any' || animal.sex === preferredSex) score += 1
  if (
    species !== 'dog' ||
    !preferredSize ||
    preferredSize === 'any' ||
    animal.size === preferredSize
  ) {
    score += 1
  }
  return score
}

function animalLabel(animal: Animal): string {
  return [
    SEX_LABELS[animal.sex],
    animal.species === 'dog' && animal.size ? SIZE_LABELS[animal.size] : null,
    SPECIES_LABELS[animal.species],
  ].filter(Boolean).join(' · ')
}

function matchesSearch(animal: Animal, search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase()
  if (!normalizedSearch) return true
  if (animal.id.toLowerCase().includes(normalizedSearch)) return true
  return [
    animal.name,
    animal.breed,
    animal.coatColor,
    animal.estimatedAge,
    SPECIES_LABELS[animal.species],
    SEX_LABELS[animal.sex],
    animal.size ? SIZE_LABELS[animal.size] : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalizedSearch)
}

function buildGroups({
  species,
  preferredSex,
  preferredSize,
  sameSpeciesAnimals,
  differentSpeciesAnimals,
  differentSpeciesVisible,
  search,
}: {
  species: Species
  preferredSex?: Sex | 'any'
  preferredSize?: Size | 'any'
  sameSpeciesAnimals: Animal[]
  differentSpeciesAnimals: Animal[]
  differentSpeciesVisible: boolean
  search: string
}): RankedAnimalGroup[] {
  const rankedSameSpecies = sameSpeciesAnimals
    .filter((animal) => matchesSearch(animal, search))
    .map((animal): RankedAnimal => {
      const score = scoreAnimal(animal, species, preferredSex, preferredSize)
      return {
        animal,
        score,
        badge: score >= 3 ? 'Compatível' : 'Mesma espécie',
        speciesChanged: false,
      }
    })
    .sort((a, b) => b.score - a.score || a.animal.name.localeCompare(b.animal.name, 'pt-BR'))

  const compatible = rankedSameSpecies.filter((item) => item.badge === 'Compatível')
  const sameSpecies = rankedSameSpecies.filter((item) => item.badge === 'Mesma espécie')

  const groups: RankedAnimalGroup[] = [
    { title: 'Mais compatíveis', animals: compatible },
    { title: 'Outros da mesma espécie', animals: sameSpecies },
  ]

  if (differentSpeciesVisible) {
    groups.push({
      title: 'Animais de outra espécie',
      animals: differentSpeciesAnimals
        .filter((animal) => matchesSearch(animal, search))
        .map((animal) => ({
          animal,
          score: 0,
          badge: 'Espécie diferente' as const,
          speciesChanged: true,
        }))
        .sort((a, b) => a.animal.name.localeCompare(b.animal.name, 'pt-BR')),
    })
  }

  return groups
}

export function ApplicationAnimalSelector({
  species,
  preferredSex,
  preferredSize,
  sameSpeciesAnimals,
  differentSpeciesAnimals,
  search,
  selectedAnimalId,
  currentAnimalName,
  loadingSameSpecies = false,
  loadingDifferentSpecies = false,
  hasMoreSameSpecies = false,
  hasMoreDifferentSpecies = false,
  fetchingMoreSameSpecies = false,
  fetchingMoreDifferentSpecies = false,
  differentSpeciesVisible,
  onSearchChange,
  onLoadMoreSameSpecies,
  onLoadMoreDifferentSpecies,
  onShowDifferentSpecies,
  onSelectAnimal,
}: ApplicationAnimalSelectorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Partial<Record<GroupTitle, boolean>>>({})
  const isSearching = search.trim().length > 0

  const groups = useMemo(
    () => buildGroups({
      species,
      preferredSex,
      preferredSize,
      sameSpeciesAnimals,
      differentSpeciesAnimals,
      differentSpeciesVisible,
      search,
    }),
    [
      differentSpeciesAnimals,
      differentSpeciesVisible,
      preferredSex,
      preferredSize,
      sameSpeciesAnimals,
      search,
      species,
    ],
  )

  const hasVisibleAnimals = groups.some((group) => group.animals.length > 0)

  function toggleGroup(groupTitle: GroupTitle) {
    setExpandedGroups((current) => ({
      ...current,
      [groupTitle]: !current[groupTitle],
    }))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">Vincular animal</span>
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nome ou ID..."
          className="pl-9"
        />
      </div>

      {currentAnimalName && selectedAnimalId && (
        <p className="text-xs text-muted-foreground">
          Selecionado: {currentAnimalName}
        </p>
      )}

      <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-background">
        {loadingSameSpecies && (
          <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Spinner size="sm" />
            Carregando animais compatíveis...
          </div>
        )}

        {!loadingSameSpecies && hasVisibleAnimals && (
          <div className="divide-y divide-border">
            {groups.map((group) => (
              group.animals.length > 0 ? (
                <div key={group.title} className="p-2">
                  <p className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                    {group.title}
                  </p>
                  <div className="flex flex-col gap-1">
                    {group.animals
                      .slice(
                        0,
                        expandedGroups[group.title]
                          ? group.animals.length
                          : isSearching
                            ? SEARCH_GROUP_VISIBLE_LIMIT
                            : DEFAULT_GROUP_VISIBLE_LIMIT,
                      )
                      .map(({ animal, badge, speciesChanged }) => {
                        const isSelected = selectedAnimalId === animal.id

                        return (
                          <button
                            key={animal.id}
                            type="button"
                            onClick={() => onSelectAnimal(animal)}
                            className={cn(
                              'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-foreground ring-1 ring-primary/25'
                                : 'hover:bg-muted/70',
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{animal.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {animalLabel(animal)}
                              </span>
                            </span>
                        <span className="flex shrink-0 items-center gap-2">
                              <Badge variant={speciesChanged ? 'warning' : 'outline'}>{badge}</Badge>
                              {isSelected && <Check size={15} className="text-primary" />}
                            </span>
                          </button>
                        )
                      })}
                    {group.animals.length > (
                      isSearching ? SEARCH_GROUP_VISIBLE_LIMIT : DEFAULT_GROUP_VISIBLE_LIMIT
                    ) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 w-fit text-primary"
                        onClick={() => toggleGroup(group.title)}
                      >
                        {expandedGroups[group.title] ? 'Ver menos' : 'Ver mais'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : null
            ))}
            {hasMoreSameSpecies && (
              <div className="p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit text-primary"
                  loading={fetchingMoreSameSpecies}
                  onClick={onLoadMoreSameSpecies}
                >
                  Carregar mais animais
                </Button>
              </div>
            )}
            {differentSpeciesVisible && hasMoreDifferentSpecies && (
              <div className="p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit text-primary"
                  loading={fetchingMoreDifferentSpecies}
                  onClick={onLoadMoreDifferentSpecies}
                >
                  Carregar mais animais de outra espécie
                </Button>
              </div>
            )}
          </div>
        )}

        {!loadingSameSpecies && !hasVisibleAnimals && (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhum animal disponível encontrado para esta busca.
          </p>
        )}
      </div>

      {!differentSpeciesVisible && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={onShowDifferentSpecies}
        >
          Ver animais de outra espécie
        </Button>
      )}

      {differentSpeciesVisible && loadingDifferentSpecies && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner size="sm" />
          Carregando animais de outra espécie...
        </div>
      )}

      {differentSpeciesVisible && hasMoreDifferentSpecies && !hasVisibleAnimals && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit text-primary"
          loading={fetchingMoreDifferentSpecies}
          onClick={onLoadMoreDifferentSpecies}
        >
          Carregar mais animais
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Preferências iniciais orientam a ordem da lista. Animais da mesma espécie podem ser vinculados mesmo quando sexo ou porte diferem.
      </p>
    </div>
  )
}
