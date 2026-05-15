import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAt,
  endAt,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import type { Species, ApplicationStatus } from '@/types/common'
import type {
  AdoptionFormData,
  AdoptionApplication,
} from '../types/adoption.types'

export interface ApplicationPage {
  applications: AdoptionApplication[]
  lastDoc: DocumentSnapshot | null
  hasMore: boolean
}

interface CreateApplicationResponse {
  id: string
  waitlistEntry: boolean
  queuePosition: number
}

export interface UpdateApplicationReviewInput {
  id: string
  status: ApplicationStatus
  adminNotes?: string
  animalId?: string
  animalName?: string
  animalIds?: string[]
  speciesChangeConfirmed?: boolean
  rejectionReason?: string
  rejectionDetails?: string
}

const ADMIN_PAGE_SIZE = 25

function docToApplication(id: string, data: Record<string, unknown>): AdoptionApplication {
  return { id, ...(data as Omit<AdoptionApplication, 'id'>) }
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// ── Public ────────────────────────────────────────────────────────────────────

/**
 * Submits an adoption application via Cloud Function, which validates fields,
 * enforces rate limiting, and writes to Firestore via Admin SDK.
 * Direct client writes to the applications collection are blocked in rules.
 */
export async function createApplication(
  animalId: string | undefined,
  animalName: string | undefined,
  species: Species,
  data: AdoptionFormData,
): Promise<CreateApplicationResponse> {
  const fn = httpsCallable<Record<string, unknown>, CreateApplicationResponse>(
    functions,
    'createApplication',
  )
  const result = await fn({
    ...data,
    species,
    ...(animalId ? { animalId } : {}),
    ...(animalName ? { animalName } : {}),
  })
  return result.data
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/**
 * Paginated admin application list with optional server-side status filter.
 * Reduces reads from limit(500) to limit(25) per page.
 */
export async function getApplicationsPaginated(
  status: ApplicationStatus | null = null,
  cursor: DocumentSnapshot | null = null,
  animalSearch = '',
): Promise<ApplicationPage> {
  const normalizedAnimalSearch = normalizeSearchText(animalSearch)
  const constraints: QueryConstraint[] = []

  if (status) constraints.push(where('status', '==', status))

  if (normalizedAnimalSearch) {
    constraints.push(orderBy('animalNameSearch', 'asc'))
    if (cursor) constraints.push(startAfter(cursor))
    else constraints.push(startAt(normalizedAnimalSearch))
    constraints.push(endAt(`${normalizedAnimalSearch}\uf8ff`))
  } else {
    constraints.push(orderBy('createdAt', 'desc'))
    if (cursor) constraints.push(startAfter(cursor))
  }

  constraints.push(limit(ADMIN_PAGE_SIZE + 1))

  const snap = await getDocs(query(collection(db, 'applications'), ...constraints))
  const hasMore = snap.docs.length > ADMIN_PAGE_SIZE
  const docs = hasMore ? snap.docs.slice(0, ADMIN_PAGE_SIZE) : snap.docs

  return {
    applications: docs.map((d) => docToApplication(d.id, d.data())),
    lastDoc: docs[docs.length - 1] ?? null,
    hasMore,
  }
}

export async function getApplicationById(id: string): Promise<AdoptionApplication | null> {
  const snap = await getDoc(doc(db, 'applications', id))
  if (!snap.exists()) return null
  return docToApplication(snap.id, snap.data())
}

export async function getActiveApplicationsForAnimal(
  animalId: string,
  excludeId: string,
): Promise<Pick<AdoptionApplication, 'id' | 'fullName' | 'status' | 'queuePosition'>[]> {
  const [legacySnap, arraySnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'applications'),
        where('animalId', '==', animalId),
        where('status', 'in', ['pending', 'in_review']),
      ),
    ),
    getDocs(
      query(
        collection(db, 'applications'),
        where('animalIds', 'array-contains', animalId),
        where('status', 'in', ['pending', 'in_review']),
      ),
    ),
  ])
  const docs = new Map([...legacySnap.docs, ...arraySnap.docs].map((d) => [d.id, d]))
  return Array.from(docs.values())
    .filter((d) => d.id !== excludeId)
    .map((d) => {
      const data = d.data()
      return {
        id: d.id,
        fullName: data.fullName as string,
        status: data.status as ApplicationStatus,
        queuePosition: data.queuePosition as number | undefined,
      }
    })
    .sort((a, b) => (a.queuePosition ?? 9999) - (b.queuePosition ?? 9999))
}

export async function updateApplicationReview(
  input: UpdateApplicationReviewInput,
): Promise<void> {
  const fn = httpsCallable<UpdateApplicationReviewInput, { success: true }>(
    functions,
    'updateApplicationReview',
  )
  await fn(input)
}

export type ApplicationPII = {
  cpf: string
  phone: string
  birthDate: string
  address: {
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
  }
}

export async function getApplicationPII(id: string): Promise<ApplicationPII> {
  const fn = httpsCallable<{ id: string }, ApplicationPII>(functions, 'getApplicationPII')
  const result = await fn({ id })
  return result.data
}

export type RejectionFlagResult =
  | { flagged: false }
  | {
      flagged: true
      flagId: string
      reason: string | null
      rejectionCount: number
      rejectedAt: unknown
      archiveFileId: string | null
    }

export async function checkRejectionFlag(applicationId: string): Promise<RejectionFlagResult> {
  const fn = httpsCallable<{ applicationId: string }, RejectionFlagResult>(
    functions,
    'checkRejectionFlag',
  )
  const result = await fn({ applicationId })
  return result.data
}

export const APPLICATION_ADMIN_PAGE_SIZE = ADMIN_PAGE_SIZE
