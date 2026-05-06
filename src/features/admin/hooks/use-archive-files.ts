import { useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import {
  listArchiveFilesPage,
  getArchiveFilterOptions,
  recalibrateArchiveFilterOptions,
  getArchiveFileUrl,
  deleteArchiveFile,
  type ArchiveFilesFilter,
  type ArchiveFilesPageResult,
} from '../services/archive.service'
import type { DocumentSnapshot } from 'firebase/firestore'

export function useArchiveFiles(filter: ArchiveFilesFilter = {}) {
  const result = useInfiniteQuery<
    ArchiveFilesPageResult,
    Error,
    InfiniteData<ArchiveFilesPageResult>,
    (string | number | null)[],
    DocumentSnapshot | null
  >({
    queryKey: ['archive-files', 'list', filter.type ?? null, filter.year ?? null],
    queryFn: ({ pageParam }) => listArchiveFilesPage(filter, pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
    staleTime: 1000 * 60 * 2,
  })

  // flatMap always produces a new array reference; memoize so downstream useMemos
  // (fallbackYears → yearSelectOptions → headerActions → config) don't recompute on
  // every render, which would otherwise trigger setHeader on every render and create
  // an infinite re-render loop via the AdminHeaderContext subscription.
  const files = useMemo(
    () => result.data?.pages.flatMap((page) => page.files) ?? [],
    [result.data],
  )

  return {
    files,
    hasMore: result.data?.pages[result.data.pages.length - 1]?.hasMore ?? false,
    isLoading: result.isLoading,
    isFetchingMore: result.isFetchingNextPage,
    error: result.error,
    fetchMore: result.fetchNextPage,
    refetch: result.refetch,
  }
}

export function useArchiveFilterOptions() {
  return useQuery({
    queryKey: ['archive-files', 'filter-options'],
    queryFn: async () => {
      const options = await getArchiveFilterOptions()
      return options ?? recalibrateArchiveFilterOptions()
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function useGetArchiveFileUrl() {
  return useMutation({
    mutationFn: (archiveFileId: string) => getArchiveFileUrl(archiveFileId),
  })
}

export function useDeleteArchiveFile() {
  return useMutation({
    mutationFn: (archiveFileId: string) => deleteArchiveFile(archiveFileId),
    onSuccess: (_, archiveFileId) => {
      queryClient.setQueriesData<InfiniteData<ArchiveFilesPageResult>>(
        { queryKey: ['archive-files', 'list'] },
        (data) => {
          if (!data) return data
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              files: page.files.filter((file) => file.id !== archiveFileId),
            })),
          }
        },
      )
      queryClient.invalidateQueries({ queryKey: ['archive-files', 'filter-options'] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['animals'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'animals'] })
    },
  })
}
