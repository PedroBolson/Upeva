import { useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getAdminAnimalsPaginated, type AnimalPage } from '../services/animals.service'
import type { AnimalStatus } from '@/types/common'
import type { DocumentSnapshot } from 'firebase/firestore'

export function useAdminAnimals(status: AnimalStatus | null = null) {
  const qc = useQueryClient()

  const result = useInfiniteQuery<AnimalPage>({
    queryKey: ['admin', 'animals', { status }],
    queryFn: ({ pageParam }) =>
      getAdminAnimalsPaginated(status, (pageParam as DocumentSnapshot | null) ?? null),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.lastDoc ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
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
    isFiltering: result.isFetching && !result.isLoading && !result.isFetchingNextPage,
    isFetchingMore: result.isFetchingNextPage,
    error: result.error,
    fetchMore: result.fetchNextPage,
    refetch: result.refetch,
    invalidate,
  }
}
