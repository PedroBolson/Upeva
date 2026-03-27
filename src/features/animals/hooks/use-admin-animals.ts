import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminAnimalsPaginated, type AnimalPage } from '../services/animals.service'
import type { AnimalStatus } from '@/types/common'
import type { DocumentSnapshot } from 'firebase/firestore'

/**
 * Infinite query for the admin animals list.
 * - Server-side status filter (Firestore where clause)
 * - Client-side name search applied on the accumulated results
 * - "Load more" pattern with 25 animals per page
 */
export function useAdminAnimals(status: AnimalStatus | null = null) {
  const qc = useQueryClient()

  const result = useInfiniteQuery<AnimalPage>({
    queryKey: ['admin', 'animals', { status }],
    queryFn: ({ pageParam }) =>
      getAdminAnimalsPaginated(status, (pageParam as DocumentSnapshot | null) ?? null),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.lastDoc ?? undefined,
  })

  const animals = result.data?.pages.flatMap((p) => p.animals) ?? []
  const hasMore = result.data?.pages[result.data.pages.length - 1]?.hasMore ?? false

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin', 'animals'] })
  }

  return {
    animals,
    hasMore,
    isLoading: result.isLoading,
    isFetchingMore: result.isFetchingNextPage,
    error: result.error,
    fetchMore: result.fetchNextPage,
    refetch: result.refetch,
    invalidate,
  }
}
