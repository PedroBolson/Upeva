import { useMemo } from 'react'
import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import {
  getAvailableAnimalsPaginated,
  getFeaturedAnimals,
  getSimilarAnimals,
  type AnimalPage,
} from '../services/animals.service'
import type { Animal, AnimalFilters } from '../types/animal.types'
import type { DocumentSnapshot } from 'firebase/firestore'

// ── Public paginated animals (Load More pattern) ──────────────────────────────

/**
 * Infinite query for the public /animais page.
 * - Server-side filters: species, sex, size (Firestore where clauses)
 * - Client-side filter: name search (applied to accumulated results)
 * - Changing any server-side filter resets to page 1
 */
export function useAnimals(filters: AnimalFilters = {}) {
  const { species, sex, size, search } = filters

  const result = useInfiniteQuery<AnimalPage>({
    queryKey: ['animals', 'public', { species, sex, size }],
    queryFn: ({ pageParam }) =>
      getAvailableAnimalsPaginated(
        { species, sex, size },
        (pageParam as DocumentSnapshot | null) ?? null,
      ),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.lastDoc ?? undefined,
    staleTime: 1000 * 60 * 5,
    // Keep previous results visible while the new filtered query loads.
    // isLoading stays false; isFetching becomes true — we show a subtle
    // overlay instead of wiping the grid and showing skeletons.
    placeholderData: keepPreviousData,
  })

  // Flatten all pages and apply client-side name search
  const allAnimals = useMemo(
    () => result.data?.pages.flatMap((p) => p.animals) ?? [],
    [result.data],
  )

  const animals = useMemo(() => {
    if (!search) return allAnimals
    const q = search.toLowerCase()
    return allAnimals.filter((a) => a.name.toLowerCase().includes(q))
  }, [allAnimals, search])

  const hasMore = result.data?.pages[result.data.pages.length - 1]?.hasMore ?? false

  return {
    animals,
    total: animals.length,
    hasMore,
    isLoading: result.isLoading,
    // true when fetching a new filter (previous data still visible)
    isFiltering: result.isFetching && !result.isFetchingNextPage,
    isFetchingMore: result.isFetchingNextPage,
    error: result.error,
    fetchMore: result.fetchNextPage,
    refetch: result.refetch,
  }
}

// ── Featured animals for the home page ───────────────────────────────────────

export function useFeaturedAnimals(count: number = 6) {
  const result = useQuery<Animal[]>({
    queryKey: ['animals', 'featured'],
    queryFn: () => getFeaturedAnimals(50),
    staleTime: 1000 * 60 * 10,
  })

  const data = useMemo(
    () => shuffled(result.data ?? []).slice(0, count),
    [result.data, count],
  )

  return { ...result, data }
}

export function useSimilarAnimals(animal: Animal | undefined) {
  return useQuery<Animal[]>({
    queryKey: ['animals', 'similar', animal?.id, animal?.species, animal?.sex, animal?.size],
    queryFn: () => getSimilarAnimals(animal!, 4),
    enabled: Boolean(animal),
    staleTime: 1000 * 60 * 5,
  })
}

function shuffled<T>(arr: T[]): T[] {
  const pool = [...arr]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}
