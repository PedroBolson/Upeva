import { useMutation, useQuery } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import {
  listArchiveFiles,
  getArchiveFilterOptions,
  recalibrateArchiveFilterOptions,
  getArchiveFileUrl,
  deleteArchiveFile,
  type ArchiveFilesFilter,
} from '../services/archive.service'

export function useArchiveFiles(filter: ArchiveFilesFilter = {}) {
  return useQuery({
    queryKey: ['archive-files', filter.type ?? null, filter.year ?? null],
    queryFn: () => listArchiveFiles(filter),
    staleTime: 1000 * 60 * 2,
  })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive-files'] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['animals'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'animals'] })
    },
  })
}
