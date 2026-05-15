import { useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import {
  listArchiveFilesPage,
  listRelatedArchiveFilesPage,
  getArchiveFilterOptions,
  recalibrateArchiveFilterOptions,
  getArchiveFileUrl,
  deleteArchiveFile,
  type ArchiveFilesFilter,
  type ArchiveFilesPageResult,
  type RelatedArchiveFilesFilter,
  type RelatedArchiveFilesCursor,
  type RelatedArchiveFilesPageResult,
} from '../services/archive.service'
import type { DocumentSnapshot } from 'firebase/firestore'

export function invalidateArchiveFileQueries({ delayedFilterOptions = false } = {}) {
  void queryClient.invalidateQueries({ queryKey: ['archive-files', 'list'] })
  void queryClient.invalidateQueries({ queryKey: ['archive-files', 'related'] })
  void queryClient.invalidateQueries({ queryKey: ['archive-files', 'filter-options'] })

  if (delayedFilterOptions) {
    globalThis.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['archive-files', 'filter-options'] })
    }, 2500)
  }
}

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

export function useRelatedArchiveFiles(filter: RelatedArchiveFilesFilter = {}) {
  const applicationId = filter.applicationId?.trim() || null
  const animalId = filter.animalId?.trim() || null
  const animalIds = filter.animalIds?.map((id) => id.trim()).filter(Boolean) ?? []

  const result = useInfiniteQuery<
    RelatedArchiveFilesPageResult,
    Error,
    InfiniteData<RelatedArchiveFilesPageResult>,
    (string | null)[],
    RelatedArchiveFilesCursor
  >({
    queryKey: ['archive-files', 'related', applicationId, animalId, animalIds.join('|')],
    queryFn: ({ pageParam }) =>
      listRelatedArchiveFilesPage({ applicationId, animalId, animalIds }, pageParam),
    initialPageParam: {},
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursors : undefined,
    enabled: Boolean(applicationId || animalId || animalIds.length > 0),
    staleTime: 1000 * 60 * 2,
  })

  const files = useMemo(() => {
    const byId = new Map<string, RelatedArchiveFilesPageResult['files'][number]>()
    for (const page of result.data?.pages ?? []) {
      for (const file of page.files) {
        byId.set(file.id, file)
      }
    }
    return Array.from(byId.values())
  }, [result.data])

  return {
    ...result,
    data: files,
    hasMore: result.hasNextPage,
    isFetchingMore: result.isFetchingNextPage,
    fetchMore: result.fetchNextPage,
  }
}

export function useArchiveDocumentUrl(archiveFileId: string | undefined) {
  return useQuery({
    queryKey: ['archive-files', 'document-url', archiveFileId],
    queryFn: () => getArchiveFileUrl(archiveFileId!),
    enabled: Boolean(archiveFileId),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
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
