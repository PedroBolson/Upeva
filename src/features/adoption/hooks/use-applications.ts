import { useInfiniteQuery } from '@tanstack/react-query'
import { getApplicationsPaginated, type ApplicationPage } from '../services/adoption.service'
import type { ApplicationStatus } from '@/types/common'
import type { DocumentSnapshot } from 'firebase/firestore'

/**
 * Infinite query for the admin applications list.
 * - Server-side status filter (Firestore where clause)
 * - "Load more" pattern with 25 applications per page
 */
export function useApplications(status: ApplicationStatus | null = null) {
  const result = useInfiniteQuery<ApplicationPage>({
    queryKey: ['applications', { status }],
    queryFn: ({ pageParam }) =>
      getApplicationsPaginated(status, (pageParam as DocumentSnapshot | null) ?? null),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.lastDoc ?? undefined,
  })

  const applications = result.data?.pages.flatMap((p) => p.applications) ?? []
  const hasMore = result.data?.pages[result.data.pages.length - 1]?.hasMore ?? false

  return {
    applications,
    hasMore,
    isLoading: result.isLoading,
    isFetchingMore: result.isFetchingNextPage,
    error: result.error,
    fetchMore: result.fetchNextPage,
    refetch: result.refetch,
  }
}
