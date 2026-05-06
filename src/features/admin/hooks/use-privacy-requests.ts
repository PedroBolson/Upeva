import { useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import {
  backfillApplicationPrivacyIndexes,
  deletePrivacyApplicationData,
  deletePrivacyArchiveFile,
  deletePrivacyRejectionFlag,
  previewPrivacyRequest,
  type PrivacySearchType,
} from '../services/privacy.service'

export function usePrivacyPreview() {
  return useMutation({
    mutationFn: ({ type, value }: { type: PrivacySearchType; value: string }) =>
      previewPrivacyRequest(type, value),
  })
}

export function usePrivacyBackfill() {
  return useMutation({
    mutationFn: () => backfillApplicationPrivacyIndexes(),
  })
}

export function useDeletePrivacyApplicationData() {
  return useMutation({
    mutationFn: ({ applicationId, reason }: { applicationId: string; reason: string }) =>
      deletePrivacyApplicationData(applicationId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'animals'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'counts'] })
    },
  })
}

export function useDeletePrivacyRejectionFlag() {
  return useMutation({
    mutationFn: ({ flagId, reason }: { flagId: string; reason: string }) =>
      deletePrivacyRejectionFlag(flagId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rejection-flags'] })
    },
  })
}

export function useDeletePrivacyArchiveFile() {
  return useMutation({
    mutationFn: ({ archiveFileId, reason }: { archiveFileId: string; reason: string }) =>
      deletePrivacyArchiveFile(archiveFileId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive-files'] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'animals'] })
    },
  })
}
