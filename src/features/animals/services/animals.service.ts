import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  orderBy,
  limit,
  startAfter,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AnimalStatus } from '@/types/common'
import type { Animal, AnimalFilters } from '../types/animal.types'

export type AnimalPayload = Omit<Animal, 'id' | 'createdAt' | 'updatedAt'>

export interface AnimalPage {
  animals: Animal[]
  lastDoc: DocumentSnapshot | null
  hasMore: boolean
}

const PUBLIC_PAGE_SIZE = 12
const ADMIN_PAGE_SIZE = 25

function docToAnimal(id: string, data: Record<string, unknown>): Animal {
  return { id, ...(data as Omit<Animal, 'id'>) }
}

function stripUndefinedFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

// ── Public ────────────────────────────────────────────────────────────────────

/**
 * Returns a paginated page of available animals, with optional server-side
 * filters for species, sex, and size.  Name search is intentionally kept
 * client-side (Firestore doesn't support full-text search natively).
 */
export async function getAvailableAnimalsPaginated(
  filters: Pick<AnimalFilters, 'species' | 'sex' | 'size'> = {},
  cursor: DocumentSnapshot | null = null,
): Promise<AnimalPage> {
  const constraints: QueryConstraint[] = [where('status', '==', 'available')]

  if (filters.species) constraints.push(where('species', '==', filters.species))
  if (filters.sex)     constraints.push(where('sex', '==', filters.sex))
  if (filters.size)    constraints.push(where('size', '==', filters.size))

  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(PUBLIC_PAGE_SIZE + 1))

  if (cursor) constraints.push(startAfter(cursor))

  const snap = await getDocs(query(collection(db, 'animals'), ...constraints))
  const hasMore = snap.docs.length > PUBLIC_PAGE_SIZE
  const docs = hasMore ? snap.docs.slice(0, PUBLIC_PAGE_SIZE) : snap.docs

  return {
    animals: docs.map((d) => docToAnimal(d.id, d.data())),
    lastDoc: docs[docs.length - 1] ?? null,
    hasMore,
  }
}

/**
 * Fetches the most recent N available animals for the home page featured rail.
 * Uses a dedicated query so it never over-fetches.
 */
export async function getFeaturedAnimals(count: number = 6): Promise<Animal[]> {
  const q = query(
    collection(db, 'animals'),
    where('status', '==', 'available'),
    orderBy('createdAt', 'desc'),
    limit(count),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToAnimal(d.id, d.data()))
}

export async function getAnimalById(id: string): Promise<Animal | null> {
  const snap = await getDoc(doc(db, 'animals', id))
  if (!snap.exists()) return null
  return docToAnimal(snap.id, snap.data())
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/**
 * Paginated admin animal list with optional status filter.
 * Reduces reads from limit(500) to limit(25) per page.
 */
export async function getAdminAnimalsPaginated(
  status: AnimalStatus | null = null,
  cursor: DocumentSnapshot | null = null,
): Promise<AnimalPage> {
  const constraints: QueryConstraint[] = [
    orderBy('createdAt', 'desc'),
    limit(ADMIN_PAGE_SIZE + 1),
  ]

  if (status) constraints.unshift(where('status', '==', status))
  if (cursor) constraints.push(startAfter(cursor))

  const snap = await getDocs(query(collection(db, 'animals'), ...constraints))
  const hasMore = snap.docs.length > ADMIN_PAGE_SIZE
  const docs = hasMore ? snap.docs.slice(0, ADMIN_PAGE_SIZE) : snap.docs

  return {
    animals: docs.map((d) => docToAnimal(d.id, d.data())),
    lastDoc: docs[docs.length - 1] ?? null,
    hasMore,
  }
}

export async function createAnimal(data: AnimalPayload): Promise<string> {
  const ref = await addDoc(collection(db, 'animals'), {
    ...stripUndefinedFields(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateAnimal(id: string, data: Partial<AnimalPayload>): Promise<void> {
  await updateDoc(doc(db, 'animals', id), {
    ...stripUndefinedFields(data),
    updatedAt: serverTimestamp(),
  })
}

export async function updateAnimalStatus(id: string, status: AnimalStatus): Promise<void> {
  await updateDoc(doc(db, 'animals', id), { status, updatedAt: serverTimestamp() })
}

