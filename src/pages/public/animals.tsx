import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PawPrint } from 'lucide-react'
import { AnimalCardSkeleton, EmptyState, ErrorState, Button } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'
import { buildPublicTitle, usePageSeo } from '@/utils/page-title'
import { AnimalCard } from '@/features/animals/components/animal-card'
import { AnimalFilters } from '@/features/animals/components/animal-filters'
import { useAnimals } from '@/features/animals/hooks/use-animals'
import type { AnimalFilters as Filters } from '@/features/animals/types/animal.types'
import type { Species, Sex, Size } from '@/types/common'

function filtersFromParams(params: URLSearchParams): Filters {
  return {
    species: (params.get('especie') as Species) || undefined,
    sex:     (params.get('sexo') as Sex) || undefined,
    size:    (params.get('porte') as Size) || undefined,
    search:  params.get('busca') || undefined,
  }
}

function paramsFromFilters(f: Filters): Record<string, string> {
  const p: Record<string, string> = {}
  if (f.species) p['especie'] = f.species
  if (f.sex)     p['sexo']    = f.sex
  if (f.size)    p['porte']   = f.size
  if (f.search)  p['busca']   = f.search
  return p
}

export function AnimalsPage() {
  usePageSeo({
    title: buildPublicTitle('Animais disponíveis'),
    description:
      'Veja cães e gatos disponíveis para adoção responsável pela Upeva e encontre seu novo companheiro.',
    path: '/animais',
  })
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = filtersFromParams(searchParams)
  const { animals, total, hasMore, isLoading, isFiltering, isFetchingMore, error, fetchMore, refetch } =
    useAnimals(filters)


  function handleFiltersChange(next: Filters) {
    setSearchParams(paramsFromFilters(next))
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-10 sm:pt-24">
      <div className="flex flex-col gap-8">
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="rounded-[1.75rem] border border-border bg-card/95 p-5 shadow-sm backdrop-blur sm:p-6"
        >
          <AnimalFilters
            filters={filters}
            onChange={handleFiltersChange}
            total={total}
          />
        </motion.div>

        {/* Anúncio acessível de resultados para leitores de tela */}
        <span aria-live="polite" aria-atomic="true" className="sr-only">
          {!isLoading && !error && !isFiltering
            ? animals.length === 0
              ? 'Nenhum animal encontrado para os filtros selecionados.'
              : `${animals.length} ${animals.length !== 1 ? 'animais' : 'animal'} encontrado${animals.length !== 1 ? 's' : ''}.`
            : ''}
        </span>

        {/* Grid — skeleton during initial load */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <AnimalCardSkeleton key={i} />
            ))}
          </div>
        )}

        {error && (
          <ErrorState
            description="Não foi possível carregar os animais. Tente novamente."
            onRetry={refetch}
          />
        )}

        {!isLoading && !error && animals.length === 0 && (
          <EmptyState
            icon={PawPrint}
            title="Nenhum animal encontrado"
            description="Tente ajustar os filtros para ver mais resultados."
            action={{ label: 'Limpar filtros', onClick: () => handleFiltersChange({}) }}
          />
        )}

        {!isLoading && !error && animals.length > 0 && (
          <div className="relative">
            {/* Spinner only during a real network fetch — no grid overlay */}
            {isFiltering && (
              <div className="absolute -top-8 right-0 z-10">
                <Spinner size="sm" />
              </div>
            )}
            {/* AnimatePresence wraps individual cards so Framer Motion can track
                which IDs enter, stay, or leave across filter changes:
                - Same ID, new position → layout animation (smooth reposition)
                - New ID → initial animation (fade in)
                - Removed ID → exit animation (fade out)
                No full-grid remount, no dimming, no piscada. */}
            <motion.div
              layout
              className={cn(
                'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6',
                isFiltering && 'pointer-events-none select-none',
              )}
            >
              <AnimatePresence mode="popLayout">
                {animals.map((animal) => (
                  <AnimalCard key={animal.id} animal={animal} />
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        {/* Load more */}
        {!isLoading && !error && animals.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            {!hasMore && !isFetchingMore && (
              <p className="text-sm text-muted-foreground">
                Mostrando todos os {total} {total !== 1 ? 'animais' : 'animal'}
              </p>
            )}
            {(hasMore || isFetchingMore) && (
              <Button
                variant="outline"
                onClick={() => fetchMore()}
                disabled={isFetchingMore}
                className="min-w-40"
              >
                {isFetchingMore ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" />
                    Carregando…
                  </span>
                ) : (
                  'Ver mais animais'
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
