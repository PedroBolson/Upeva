import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Species, ApplicationStatus } from '@/types/common'
import type {
  AdoptionFormData,
  AdoptionApplication,
  CreateApplicationPayload,
} from '../types/adoption.types'

function docToApplication(id: string, data: Record<string, unknown>): AdoptionApplication {
  return { id, ...(data as Omit<AdoptionApplication, 'id'>) }
}

// ── Public ────────────────────────────────────────────────────────────────────

export async function createApplication(
  animalId: string,
  animalName: string,
  species: Species,
  data: AdoptionFormData,
): Promise<string> {
  const payload: Omit<CreateApplicationPayload, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>
    updatedAt: ReturnType<typeof serverTimestamp>
    status: 'pending'
  } = {
    ...data,
    animalId,
    animalName,
    species,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const ref = await addDoc(collection(db, 'applications'), payload)
  return ref.id
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getApplications(): Promise<AdoptionApplication[]> {
  const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'), limit(500))
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToApplication(d.id, d.data()))
}

export async function getApplicationById(id: string): Promise<AdoptionApplication | null> {
  const snap = await getDoc(doc(db, 'applications', id))
  if (!snap.exists()) return null
  return docToApplication(snap.id, snap.data())
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  adminNotes?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  }
  if (adminNotes !== undefined) payload.adminNotes = adminNotes
  await updateDoc(doc(db, 'applications', id), payload)
}
