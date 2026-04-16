import {
  addDoc,
  collection,
  deleteDoc,
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
import { deleteAnimalPhoto } from './animal-storage.service'
import { getFeaturedAnimalsCache } from './featured-animals.service'
import type { AnimalStatus, Sex, Size, Species } from '@/types/common'
import type { Animal, AnimalFilters } from '../types/animal.types'

export type AnimalPayload = Omit<Animal, 'id' | 'createdAt' | 'updatedAt'>

export interface AnimalPage {
  animals: Animal[]
  lastDoc: DocumentSnapshot | null
  hasMore: boolean
}

const PUBLIC_PAGE_SIZE = 12
const ADMIN_PAGE_SIZE = 25
const LINKABLE_ANIMALS_LIMIT = 25

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
  const constraints: QueryConstraint[] = [where('status', 'in', ['available', 'under_review'])]

  if (filters.species) constraints.push(where('species', '==', filters.species))
  if (filters.sex) constraints.push(where('sex', '==', filters.sex))
  if (filters.size) constraints.push(where('size', '==', filters.size))

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
 * Returns a pool of animals for the home page featured rail.
 *
 * - If the admin curated pool has >= displayCount animals: returns the full
 *   curated pool so the caller can shuffle and rotate among them.
 * - If the pool is smaller than displayCount: complements with random animals
 *   (excluding already-featured IDs) to reach exactly displayCount.
 *
 * This ensures featured animals are never mixed with random ones when the
 * admin has configured enough destaques.
 */
export async function getFeaturedAnimals(displayCount: number = 4): Promise<Animal[]> {
  const cache = await getFeaturedAnimalsCache()
  const featured = cache?.items ?? []

  // Admin has enough featured animals — return full pool for caller to shuffle
  if (featured.length >= displayCount) return featured

  // Not enough featured animals — complement with random to reach displayCount
  const needed = displayCount - featured.length
  const featuredIds = new Set(featured.map((a) => a.id))
  const q = query(
    collection(db, 'animals'),
    where('status', 'in', ['available', 'under_review']),
    limit(Math.min(needed * 2, 20)),
  )
  const snap = await getDocs(q)
  const complement = snap.docs
    .map((d) => docToAnimal(d.id, d.data()))
    .filter((a) => !featuredIds.has(a.id))
    .slice(0, needed)

  return [...featured, ...complement]
}

type SimilarAnimalSeed = Pick<Animal, 'id' | 'species' | 'sex' | 'size'>

async function getAvailableAnimalsByFilters(
  filters: Pick<AnimalFilters, 'species' | 'sex' | 'size'>,
  count: number,
): Promise<Animal[]> {
  const constraints: QueryConstraint[] = [where('status', '==', 'available')]

  if (filters.species) constraints.push(where('species', '==', filters.species))
  if (filters.sex) constraints.push(where('sex', '==', filters.sex))
  if (filters.size) constraints.push(where('size', '==', filters.size))

  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(count))

  const snap = await getDocs(query(collection(db, 'animals'), ...constraints))
  return snap.docs.map((d) => docToAnimal(d.id, d.data()))
}

function buildSimilarQueryPlan(
  animal: SimilarAnimalSeed,
): Array<Pick<AnimalFilters, 'species' | 'sex' | 'size'>> {
  const plan: Array<Pick<AnimalFilters, 'species' | 'sex' | 'size'>> = []

  if (animal.species === 'dog' && animal.size) {
    plan.push({
      species: animal.species,
      sex: animal.sex,
      size: animal.size,
    })
  }

  plan.push({ species: animal.species, sex: animal.sex })
  plan.push({ species: animal.species })

  const seen = new Set<string>()
  return plan.filter((filters) => {
    const key = JSON.stringify(filters)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Fetches up to `count` similar available animals, prioritizing:
 * 1. same species + same sex + same size (dogs only)
 * 2. same species + same sex
 * 3. same species
 */
export async function getSimilarAnimals(
  animal: SimilarAnimalSeed,
  count: number = 4,
): Promise<Animal[]> {
  const cacheSnap = await getDoc(doc(db, 'animalSimilarityCache', animal.id))
  if (cacheSnap.exists()) {
    const items = (cacheSnap.data().items as Animal[]) ?? []
    if (items.length > 0) return items.slice(0, count)
  }

  const matches: Animal[] = []
  const seenIds = new Set<string>([animal.id])
  const fetchLimit = Math.max(count * 2, 8)

  for (const filters of buildSimilarQueryPlan(animal)) {
    if (matches.length >= count) break

    const candidates = await getAvailableAnimalsByFilters(filters, fetchLimit)
    for (const candidate of candidates) {
      if (seenIds.has(candidate.id)) continue

      seenIds.add(candidate.id)
      matches.push(candidate)

      if (matches.length >= count) break
    }
  }

  return matches
}

export async function getAnimalById(id: string): Promise<Animal | null> {
  const snap = await getDoc(doc(db, 'animals', id))
  if (!snap.exists()) return null
  return docToAnimal(snap.id, snap.data())
}

export interface LinkableAnimalFilters {
  species: Species
  preferredSex?: Sex | 'any'
  preferredSize?: Size | 'any'
}

export async function getLinkableAnimalsForApplication(
  filters: LinkableAnimalFilters,
): Promise<Animal[]> {
  const constraints: QueryConstraint[] = [
    where('status', 'in', ['available', 'under_review']),
    where('species', '==', filters.species),
  ]

  if (filters.preferredSex && filters.preferredSex !== 'any') {
    constraints.push(where('sex', '==', filters.preferredSex))
  }

  if (filters.species === 'dog' && filters.preferredSize && filters.preferredSize !== 'any') {
    constraints.push(where('size', '==', filters.preferredSize))
  }

  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(LINKABLE_ANIMALS_LIMIT))

  const snap = await getDocs(query(collection(db, 'animals'), ...constraints))
  return snap.docs.map((d) => docToAnimal(d.id, d.data()))
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

export async function deleteAnimal(id: string, photoUrls: string[] = []): Promise<void> {
  const linkedApplications = await getDocs(
    query(collection(db, 'applications'), where('animalId', '==', id), limit(1)),
  )

  if (!linkedApplications.empty) {
    throw new Error('linked-applications')
  }

  await Promise.all(photoUrls.map(deleteAnimalPhoto))

  await deleteDoc(doc(db, 'animals', id))
}
