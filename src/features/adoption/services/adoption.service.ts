import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
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
  rejectionReason?: string
  rejectionDetails?: string
}

const ADMIN_PAGE_SIZE = 25

function docToApplication(id: string, data: Record<string, unknown>): AdoptionApplication {
  return { id, ...(data as Omit<AdoptionApplication, 'id'>) }
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
): Promise<ApplicationPage> {
  const constraints: QueryConstraint[] = [
    orderBy('createdAt', 'desc'),
    limit(ADMIN_PAGE_SIZE + 1),
  ]

  if (status) constraints.unshift(where('status', '==', status))
  if (cursor) constraints.push(startAfter(cursor))

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
  const snap = await getDocs(
    query(
      collection(db, 'applications'),
      where('animalId', '==', animalId),
      where('status', 'in', ['pending', 'in_review']),
    ),
  )
  return snap.docs
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

export const APPLICATION_ADMIN_PAGE_SIZE = ADMIN_PAGE_SIZE
