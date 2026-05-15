import { useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getAdminAnimalsPaginated, type AnimalPage } from '../services/animals.service'
import type { AnimalStatus } from '@/types/common'
import type { DocumentSnapshot } from 'firebase/firestore'

interface AdminAnimalsFilters {
  status?: AnimalStatus | null
  statuses?: AnimalStatus[] | null
  search?: string
}

export function useAdminAnimals(statusOrFilters: AnimalStatus | null | AdminAnimalsFilters = null) {
  const qc = useQueryClient()
  const filters = typeof statusOrFilters === 'object' && statusOrFilters !== null
    ? statusOrFilters
    : { status: statusOrFilters }
  const status = filters.status ?? null
  const statuses = filters.statuses ?? null
  const search = filters.search?.trim() ?? ''

  const result = useInfiniteQuery<AnimalPage>({
    queryKey: ['admin', 'animals', { status, statuses: statuses?.join('|') ?? null, search }],
    queryFn: ({ pageParam }) =>
      getAdminAnimalsPaginated(
        status,
        (pageParam as DocumentSnapshot | null) ?? null,
        search,
        statuses,
      ),
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
