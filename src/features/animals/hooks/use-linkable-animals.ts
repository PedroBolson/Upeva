import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  getLinkableAnimalsPageForApplication,
  type LinkableAnimalFilters,
  type LinkableAnimalsCursor,
  type LinkableAnimalsPage,
} from '../services/animals.service'
import type { Animal } from '../types/animal.types'

export function useLinkableAnimals(filters: LinkableAnimalFilters, enabled: boolean) {
  const result = useInfiniteQuery<LinkableAnimalsPage>({
    queryKey: [
      'animals',
      'linkable-application-page',
      filters.scope ?? 'same-species',
      filters.species,
      filters.search ?? '',
      filters.pageSize ?? null,
    ],
    queryFn: ({ pageParam }) =>
      getLinkableAnimalsPageForApplication(
        filters,
        (pageParam as LinkableAnimalsCursor | null) ?? null,
      ),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursor : undefined,
    enabled,
    staleTime: 1000 * 60 * 5,
  })

  const animals = useMemo(() => {
    const byId = new Map<string, Animal>()
    for (const page of result.data?.pages ?? []) {
      for (const animal of page.animals) {
        byId.set(animal.id, animal)
      }
    }
    return Array.from(byId.values())
  }, [result.data])

  return {
    animals,
    hasMore: result.hasNextPage,
    isLoading: result.isLoading,
    isFetchingMore: result.isFetchingNextPage,
    error: result.error,
    fetchMore: result.fetchNextPage,
    refetch: result.refetch,
  }
}
