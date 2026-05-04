import { useMutation, useQuery } from '@tanstack/react-query'
import {
  listArchiveFiles,
  getArchiveFileUrl,
  type ArchiveFilesFilter,
} from '../services/archive.service'

export function useArchiveFiles(filter: ArchiveFilesFilter = {}) {
  return useQuery({
    queryKey: ['archive-files', filter.type ?? null, filter.year ?? null],
    queryFn: () => listArchiveFiles(filter),
    staleTime: 1000 * 60 * 2,
  })
}

export function useGetArchiveFileUrl() {
  return useMutation({
    mutationFn: (archiveFileId: string) => getArchiveFileUrl(archiveFileId),
  })
}
