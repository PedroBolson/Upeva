import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

export type PrivacySearchType = 'cpf' | 'email'

export interface PrivacyPreviewApplication {
  id: string
  status: string | null
  species: string | null
  animalId: string | null
  animalName: string | null
  createdAt: unknown
  updatedAt: unknown
  reviewedAt: unknown
  pendingExport: boolean
  contractArchiveFileId: string | null
  contractGenerationStatus: string | null
}

export interface PrivacyPreviewRejectionFlag {
  flagId: string
  reason: string | null
  rejectionCount: number
  rejectedAt: unknown
  archiveFileId: string | null
}

export interface PrivacyPreviewArchiveFile {
  id: string
  type: string | null
  fileName: string | null
  year: number | null
  applicationId: string | null
  animalId: string | null
  animalName: string | null
  species: string | null
  createdAt: unknown
  sizeBytes: number
  status: string | null
}

export interface PrivacyWarning {
  code: string
  message: string
}

export interface PrivacyPreview {
  applications: PrivacyPreviewApplication[]
  rejectionFlags: PrivacyPreviewRejectionFlag[]
  archiveFiles: PrivacyPreviewArchiveFile[]
  warnings: PrivacyWarning[]
}

export interface PrivacyBackfillResult {
  scannedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  hasMore: boolean
}

export async function previewPrivacyRequest(
  type: PrivacySearchType,
  value: string,
): Promise<PrivacyPreview> {
  const fn = httpsCallable<{ type: PrivacySearchType; value: string }, PrivacyPreview>(
    functions,
    'previewPrivacyRequest',
  )
  const result = await fn({ type, value })
  return result.data
}

export async function backfillApplicationPrivacyIndexes(): Promise<PrivacyBackfillResult> {
  const fn = httpsCallable<void, PrivacyBackfillResult>(
    functions,
    'backfillApplicationPrivacyIndexes',
  )
  const result = await fn()
  return result.data
}

export async function deletePrivacyApplicationData(
  applicationId: string,
  reason: string,
): Promise<void> {
  const fn = httpsCallable<{ applicationId: string; reason: string }, { success: true }>(
    functions,
    'deletePrivacyApplicationData',
  )
  await fn({ applicationId, reason })
}

export async function deletePrivacyRejectionFlag(flagId: string, reason: string): Promise<void> {
  const fn = httpsCallable<{ flagId: string; reason: string }, { success: true }>(
    functions,
    'deletePrivacyRejectionFlag',
  )
  await fn({ flagId, reason })
}

export async function deletePrivacyArchiveFile(archiveFileId: string, reason: string): Promise<void> {
  const fn = httpsCallable<{ archiveFileId: string; reason: string }, { success: true }>(
    functions,
    'deletePrivacyArchiveFile',
  )
  await fn({ archiveFileId, reason })
}
