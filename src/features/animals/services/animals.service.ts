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
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AnimalStatus } from '@/types/common'
import type { Animal } from '../types/animal.types'

export type AnimalPayload = Omit<Animal, 'id' | 'createdAt' | 'updatedAt'>

function docToAnimal(id: string, data: Record<string, unknown>): Animal {
  return { id, ...(data as Omit<Animal, 'id'>) }
}

function stripUndefinedFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

function getTimestampMs(value: unknown): number {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis()
  }

  return 0
}

function sortAnimalsByCreatedAtDesc(animals: Animal[]): Animal[] {
  return [...animals].sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
}

// ── Public ────────────────────────────────────────────────────────────────────

export async function getAvailableAnimals(): Promise<Animal[]> {
  const q = query(
    collection(db, 'animals'),
    where('status', '==', 'available'),
    limit(200),
  )
  const snap = await getDocs(q)
  return sortAnimalsByCreatedAtDesc(snap.docs.map((d) => docToAnimal(d.id, d.data())))
}

export async function getFeaturedAnimals(count: number = 6): Promise<Animal[]> {
  const animals = await getAvailableAnimals()
  return animals.slice(0, count)
}

export async function getAnimalById(id: string): Promise<Animal | null> {
  const snap = await getDoc(doc(db, 'animals', id))
  if (!snap.exists()) return null
  return docToAnimal(snap.id, snap.data())
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getAdminAnimals(): Promise<Animal[]> {
  const q = query(collection(db, 'animals'), orderBy('createdAt', 'desc'), limit(500))
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToAnimal(d.id, d.data()))
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
