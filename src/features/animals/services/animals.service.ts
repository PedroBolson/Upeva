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
  startAt,
  endAt,
  startAfter,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { getFeaturedAnimalsCache } from './featured-animals.service'
import type { AnimalStatus, Sex, Size, Species, ArchiveReason } from '@/types/common'
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
const LINKABLE_ANIMALS_SCOPE_LIMIT = 25
const LINKABLE_ANIMALS_PAGE_SIZE = 25
const SIMILAR_ANIMAL_STATUSES = new Set<AnimalStatus>(['available'])

function docToAnimal(id: string, data: Record<string, unknown>): Animal {
  return { id, ...(data as Omit<Animal, 'id'>) }
}

function isSimilarAnimal(animal: Animal): boolean {
  return SIMILAR_ANIMAL_STATUSES.has(animal.status)
}

function stripUndefinedFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

export function normalizeAnimalNameSearch(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function decorateAnimalPayload<T extends Partial<AnimalPayload>>(data: T): T & { nameSearch?: string } {
  return {
    ...data,
    ...(typeof data.name === 'string'
      ? { nameSearch: normalizeAnimalNameSearch(data.name) }
      : {}),
  }
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
    const similarItems = items.filter(isSimilarAnimal)
    if (similarItems.length > 0) return similarItems.slice(0, count)
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
  scope?: 'same-species' | 'different-species'
  search?: string
  pageSize?: number
}

export interface LinkableAnimalsCursor {
  searchDoc?: DocumentSnapshot | null
  scanDoc?: DocumentSnapshot | null
}

export interface LinkableAnimalsPage {
  animals: Animal[]
  cursor: LinkableAnimalsCursor | null
  hasMore: boolean
}

async function queryLinkableAnimals(
  filters: Pick<AnimalFilters, 'species' | 'sex' | 'size'>,
  count: number,
): Promise<Animal[]> {
  const constraints: QueryConstraint[] = [
    where('status', 'in', ['available', 'under_review']),
  ]

  if (filters.species) constraints.push(where('species', '==', filters.species))
  if (filters.sex) constraints.push(where('sex', '==', filters.sex))
  if (filters.size) constraints.push(where('size', '==', filters.size))

  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limit(count))

  const snap = await getDocs(query(collection(db, 'animals'), ...constraints))
  return snap.docs.map((d) => docToAnimal(d.id, d.data()))
}

function getOtherSpecies(species: Species): Species {
  return species === 'cat' ? 'dog' : 'cat'
}

export async function getLinkableAnimalsForApplication(
  filters: LinkableAnimalFilters,
): Promise<Animal[]> {
  if (filters.scope === 'different-species') {
    return queryLinkableAnimals(
      { species: getOtherSpecies(filters.species) },
      LINKABLE_ANIMALS_SCOPE_LIMIT,
    )
  }

  const queryPlans: Array<Pick<AnimalFilters, 'species' | 'sex' | 'size'>> = []
  const preferredSex = filters.preferredSex && filters.preferredSex !== 'any'
    ? filters.preferredSex
    : undefined
  const preferredSize = filters.species === 'dog' &&
    filters.preferredSize &&
    filters.preferredSize !== 'any'
    ? filters.preferredSize
    : undefined

  if (preferredSex || preferredSize) {
    queryPlans.push({
      species: filters.species,
      sex: preferredSex,
      size: preferredSize,
    })
  }
  queryPlans.push({ species: filters.species })

  const animals: Animal[] = []
  const seen = new Set<string>()
  for (const queryFilters of queryPlans) {
    const result = await queryLinkableAnimals(queryFilters, LINKABLE_ANIMALS_LIMIT)
    for (const animal of result) {
      if (seen.has(animal.id)) continue
      seen.add(animal.id)
      animals.push(animal)
    }
  }

  return animals.slice(0, LINKABLE_ANIMALS_LIMIT * queryPlans.length)
}

function isLinkableAnimal(animal: Animal, species: Species): boolean {
  return (
    animal.species === species &&
    (animal.status === 'available' || animal.status === 'under_review')
  )
}

function matchesLegacyLinkableSearch(animal: Animal, normalizedSearch: string): boolean {
  if (!normalizedSearch) return true
  return (
    normalizeAnimalNameSearch(animal.name).includes(normalizedSearch) ||
    animal.id.toLowerCase().includes(normalizedSearch)
  )
}

async function getExactLinkableAnimalById(
  id: string,
  species: Species,
): Promise<Animal | null> {
  if (!id) return null
  const snap = await getDoc(doc(db, 'animals', id))
  if (!snap.exists()) return null

  const animal = docToAnimal(snap.id, snap.data())
  return isLinkableAnimal(animal, species) ? animal : null
}

async function getLinkableAnimalsSearchPage(
  species: Species,
  rawSearch: string,
  normalizedSearch: string,
  cursor: LinkableAnimalsCursor | null,
  pageSize: number,
): Promise<LinkableAnimalsPage> {
  const searchConstraints: QueryConstraint[] = [
    where('status', 'in', ['available', 'under_review']),
    where('species', '==', species),
    orderBy('nameSearch', 'asc'),
  ]

  if (cursor?.searchDoc) {
    searchConstraints.push(startAfter(cursor.searchDoc))
  } else {
    searchConstraints.push(startAt(normalizedSearch))
  }

  searchConstraints.push(endAt(`${normalizedSearch}\uf8ff`), limit(pageSize + 1))

  const scanConstraints: QueryConstraint[] = [
    where('status', 'in', ['available', 'under_review']),
    where('species', '==', species),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ]

  if (cursor?.scanDoc) scanConstraints.push(startAfter(cursor.scanDoc))

  const [exactAnimal, searchSnap, scanSnap] = await Promise.all([
    cursor ? Promise.resolve(null) : getExactLinkableAnimalById(rawSearch.trim(), species),
    getDocs(query(collection(db, 'animals'), ...searchConstraints)),
    getDocs(query(collection(db, 'animals'), ...scanConstraints)),
  ])

  const searchHasMore = searchSnap.docs.length > pageSize
  const scanHasMore = scanSnap.docs.length > pageSize
  const searchDocs = searchHasMore ? searchSnap.docs.slice(0, pageSize) : searchSnap.docs
  const scanDocs = scanHasMore ? scanSnap.docs.slice(0, pageSize) : scanSnap.docs

  const animalsById = new Map<string, Animal>()
  if (exactAnimal) animalsById.set(exactAnimal.id, exactAnimal)
  for (const docSnap of searchDocs) {
    const animal = docToAnimal(docSnap.id, docSnap.data())
    animalsById.set(animal.id, animal)
  }
  for (const docSnap of scanDocs) {
    const animal = docToAnimal(docSnap.id, docSnap.data())
    if (matchesLegacyLinkableSearch(animal, normalizedSearch)) {
      animalsById.set(animal.id, animal)
    }
  }

  return {
    animals: Array.from(animalsById.values()),
    cursor: {
      searchDoc: searchDocs[searchDocs.length - 1] ?? cursor?.searchDoc ?? null,
      scanDoc: scanDocs[scanDocs.length - 1] ?? cursor?.scanDoc ?? null,
    },
    hasMore: searchHasMore || scanHasMore,
  }
}

export async function getLinkableAnimalsPageForApplication(
  filters: LinkableAnimalFilters,
  cursor: LinkableAnimalsCursor | null = null,
): Promise<LinkableAnimalsPage> {
  const pageSize = filters.pageSize ?? LINKABLE_ANIMALS_PAGE_SIZE
  const species = filters.scope === 'different-species'
    ? getOtherSpecies(filters.species)
    : filters.species
  const normalizedSearch = normalizeAnimalNameSearch(filters.search ?? '')

  if (normalizedSearch) {
    return getLinkableAnimalsSearchPage(species, filters.search ?? '', normalizedSearch, cursor, pageSize)
  }

  const constraints: QueryConstraint[] = [
    where('status', 'in', ['available', 'under_review']),
    where('species', '==', species),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ]

  if (cursor?.scanDoc) constraints.push(startAfter(cursor.scanDoc))

  const snap = await getDocs(query(collection(db, 'animals'), ...constraints))
  const hasMore = snap.docs.length > pageSize
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs

  return {
    animals: docs.map((d) => docToAnimal(d.id, d.data())),
    cursor: {
      searchDoc: null,
      scanDoc: docs[docs.length - 1] ?? null,
    },
    hasMore,
  }
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
    ...stripUndefinedFields(decorateAnimalPayload(data)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateAnimal(id: string, data: Partial<AnimalPayload>): Promise<void> {
  await updateDoc(doc(db, 'animals', id), {
    ...stripUndefinedFields(decorateAnimalPayload(data)),
    updatedAt: serverTimestamp(),
  })
}

export async function updateAnimalStatus(id: string, status: AnimalStatus): Promise<void> {
  const fn = httpsCallable<
    { animalId: string; status: AnimalStatus },
    { success: true }
  >(functions, 'updateAnimalStatus')
  await fn({ animalId: id, status })
}

export type ArchiveAnimalInput = {
  animalId: string
  archiveReason: ArchiveReason
  archiveDetails: string
  archiveDate: string
}

export async function archiveAnimal(input: ArchiveAnimalInput): Promise<void> {
  const fn = httpsCallable<ArchiveAnimalInput, { success: true }>(functions, 'archiveAnimal')
  await fn(input)
}

export type DeleteAnimalInput = {
  animalId: string
  reason: string
}

export async function deleteAnimal(input: DeleteAnimalInput): Promise<void> {
  const fn = httpsCallable<DeleteAnimalInput, { success: true }>(functions, 'deleteAnimal')
  await fn(input)
}
