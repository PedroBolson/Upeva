import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'

export type ArchiveFileType = 'contract' | 'rejection' | 'archivedAnimal'

export interface ArchiveFile {
  id: string
  type: ArchiveFileType
  storagePath: string
  fileName: string
  contentType: string
  sizeBytes: number
  year: number
  applicationId?: string | null
  animalId?: string | null
  animalName?: string | null
  species?: string | null
  reviewerLabel?: string | null
  createdAt: unknown
  status: string
}

export interface ArchiveFilesFilter {
  type?: ArchiveFileType | null
  year?: number | null
}

export async function listArchiveFiles(filter: ArchiveFilesFilter = {}): Promise<ArchiveFile[]> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]

  if (filter.type) constraints.unshift(where('type', '==', filter.type))
  if (filter.year) constraints.unshift(where('year', '==', filter.year))

  const snap = await getDocs(query(collection(db, 'archiveFiles'), ...constraints))
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      type: data.type as ArchiveFileType,
      storagePath: data.storagePath as string,
      fileName: data.fileName as string,
      contentType: data.contentType as string,
      sizeBytes: (data.sizeBytes as number) ?? 0,
      year: (data.year as number) ?? 0,
      applicationId: (data.applicationId as string | null) ?? null,
      animalId: (data.animalId as string | null) ?? null,
      animalName: (data.animalName as string | null) ?? null,
      species: (data.species as string | null) ?? null,
      reviewerLabel: (data.reviewerLabel as string | null) ?? null,
      createdAt: data.createdAt ?? null,
      status: (data.status as string) ?? 'stored',
    }
  })
}

export async function getArchiveFileUrl(archiveFileId: string): Promise<string> {
  const fn = httpsCallable<{ archiveFileId: string }, { url: string }>(
    functions,
    'getArchiveFileUrl',
  )
  const result = await fn({ archiveFileId })
  return result.data.url
}
