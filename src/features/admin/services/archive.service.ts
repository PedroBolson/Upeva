import {
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'

export type ArchiveFileType = 'contract' | 'rejection' | 'archivedAnimal'

export const ARCHIVE_FILES_PAGE_SIZE = 25

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
  animalIds?: string[]
  animalName?: string | null
  animalNames?: string[]
  species?: string | null
  reviewerLabel?: string | null
  createdAt: unknown
  status: string
}

export interface ArchiveFilesFilter {
  type?: ArchiveFileType | null
  year?: number | null
}

export interface RelatedArchiveFilesFilter {
  applicationId?: string | null
  animalId?: string | null
  animalIds?: string[]
}

export type RelatedArchiveFilesCursor = Record<string, DocumentSnapshot | null>

export interface ArchiveFilterOptions {
  years: number[]
  yearsByType: Record<ArchiveFileType, number[]>
}

export interface ArchiveFilesPageResult {
  files: ArchiveFile[]
  lastDoc: DocumentSnapshot | null
  hasMore: boolean
}

export interface RelatedArchiveFilesPageResult {
  files: ArchiveFile[]
  cursors: RelatedArchiveFilesCursor
  hasMore: boolean
}

function normalizeYears(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((year): year is number => Number.isInteger(year) && year > 0)
    .sort((a, b) => b - a)
}

function docToArchiveFile(id: string, data: Record<string, unknown>): ArchiveFile {
  return {
    id,
    type: data.type as ArchiveFileType,
    storagePath: data.storagePath as string,
    fileName: data.fileName as string,
    contentType: data.contentType as string,
    sizeBytes: (data.sizeBytes as number) ?? 0,
    year: (data.year as number) ?? 0,
    applicationId: (data.applicationId as string | null) ?? null,
    animalId: (data.animalId as string | null) ?? null,
    animalIds: Array.isArray(data.animalIds)
      ? data.animalIds.filter((id): id is string => typeof id === 'string')
      : [],
    animalName: (data.animalName as string | null) ?? null,
    animalNames: Array.isArray(data.animalNames)
      ? data.animalNames.filter((name): name is string => typeof name === 'string')
      : [],
    species: (data.species as string | null) ?? null,
    reviewerLabel: (data.reviewerLabel as string | null) ?? null,
    createdAt: data.createdAt ?? null,
    status: (data.status as string) ?? 'stored',
  }
}

function archiveCreatedAtMillis(file: ArchiveFile): number {
  const ts = file.createdAt as { seconds?: number } | null
  return ts?.seconds ? ts.seconds * 1000 : 0
}

export async function listArchiveFilesPage(
  filter: ArchiveFilesFilter = {},
  cursor: DocumentSnapshot | null = null,
  pageSize = ARCHIVE_FILES_PAGE_SIZE,
): Promise<ArchiveFilesPageResult> {
  const constraints: QueryConstraint[] = []

  if (filter.type) constraints.push(where('type', '==', filter.type))
  if (filter.year) constraints.push(where('year', '==', filter.year))

  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(pageSize))
  if (cursor) constraints.push(startAfter(cursor))

  const snap = await getDocs(query(collection(db, 'archiveFiles'), ...constraints))
  const docs = snap.docs

  return {
    files: docs.map((d) => docToArchiveFile(d.id, d.data())),
    lastDoc: docs[docs.length - 1] ?? null,
    hasMore: docs.length === pageSize,
  }
}

async function listArchiveFilesByFieldPage(
  field: 'applicationId' | 'animalId' | 'animalIds',
  value: string,
  cursor: DocumentSnapshot | null = null,
  pageSize = ARCHIVE_FILES_PAGE_SIZE,
): Promise<{ files: ArchiveFile[], lastDoc: DocumentSnapshot | null, hasMore: boolean }> {
  const constraints: QueryConstraint[] = [
    field === 'animalIds' ? where(field, 'array-contains', value) : where(field, '==', value),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ]
  if (cursor) constraints.push(startAfter(cursor))

  const snap = await getDocs(query(
    collection(db, 'archiveFiles'),
    ...constraints,
  ))
  const hasMore = snap.docs.length > pageSize
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs

  return {
    files: docs.map((d) => docToArchiveFile(d.id, d.data())),
    lastDoc: docs[docs.length - 1] ?? null,
    hasMore,
  }
}

export async function listRelatedArchiveFilesPage(
  filter: RelatedArchiveFilesFilter,
  cursors: RelatedArchiveFilesCursor = {},
): Promise<RelatedArchiveFilesPageResult> {
  const queries: Array<{
    key: string
    field: 'applicationId' | 'animalId' | 'animalIds'
    value: string
  }> = []
  const applicationId = filter.applicationId?.trim()
  const animalId = filter.animalId?.trim()

  if (applicationId) queries.push({ key: `applicationId:${applicationId}`, field: 'applicationId', value: applicationId })
  if (animalId) queries.push({ key: `animalId:${animalId}`, field: 'animalId', value: animalId })
  if (animalId) queries.push({ key: `animalIds:${animalId}`, field: 'animalIds', value: animalId })
  for (const id of filter.animalIds ?? []) {
    const cleanId = id.trim()
    if (cleanId && cleanId !== animalId) {
      queries.push({ key: `animalIds:${cleanId}`, field: 'animalIds', value: cleanId })
    }
  }
  if (queries.length === 0) return { files: [], cursors: {}, hasMore: false }

  const results = await Promise.all(
    queries.map(async (item) => ({
      key: item.key,
      result: await listArchiveFilesByFieldPage(item.field, item.value, cursors[item.key] ?? null),
    })),
  )
  const deduped = new Map<string, ArchiveFile>()
  const nextCursors: RelatedArchiveFilesCursor = { ...cursors }
  let hasMore = false

  for (const { key, result } of results) {
    for (const file of result.files) {
      deduped.set(file.id, file)
    }
    nextCursors[key] = result.lastDoc
    hasMore ||= result.hasMore
  }

  return {
    files: Array.from(deduped.values())
      .sort((a, b) => archiveCreatedAtMillis(b) - archiveCreatedAtMillis(a)),
    cursors: nextCursors,
    hasMore,
  }
}

export async function listRelatedArchiveFiles(
  filter: RelatedArchiveFilesFilter,
): Promise<ArchiveFile[]> {
  const firstPage = await listRelatedArchiveFilesPage(filter)
  return firstPage.files
}

export async function getArchiveFilterOptions(): Promise<ArchiveFilterOptions | null> {
  const snap = await getDoc(doc(db, 'metadata', 'archiveFileFilters'))
  if (!snap.exists()) return null
  const data = snap.data()
  const yearsByType = data?.yearsByType as Partial<Record<ArchiveFileType, unknown>> | undefined

  return {
    years: normalizeYears(data?.years),
    yearsByType: {
      contract: normalizeYears(yearsByType?.contract),
      rejection: normalizeYears(yearsByType?.rejection),
      archivedAnimal: normalizeYears(yearsByType?.archivedAnimal),
    },
  }
}

export async function recalibrateArchiveFilterOptions(): Promise<ArchiveFilterOptions> {
  const fn = httpsCallable<void, ArchiveFilterOptions>(functions, 'recalibrateArchiveFileFilters')
  const result = await fn()
  return result.data
}

export async function getArchiveFileUrl(archiveFileId: string): Promise<string> {
  const fn = httpsCallable<{ archiveFileId: string }, { url: string }>(
    functions,
    'getArchiveFileUrl',
  )
  const result = await fn({ archiveFileId })
  return result.data.url
}

export async function generateAdoptionContractNow(
  applicationId: string,
): Promise<{ archiveFileId: string; alreadyExists?: boolean }> {
  const fn = httpsCallable<
    { applicationId: string },
    { archiveFileId: string; alreadyExists?: boolean }
  >(functions, 'generateAdoptionContractNow')
  const result = await fn({ applicationId })
  return result.data
}

export async function deleteArchiveFile(archiveFileId: string): Promise<void> {
  const fn = httpsCallable<{ archiveFileId: string }, { success: true }>(
    functions,
    'deleteArchiveFile',
  )
  await fn({ archiveFileId })
}
