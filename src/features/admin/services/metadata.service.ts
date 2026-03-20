import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AnimalStatus, ApplicationStatus } from '@/types/common'

export interface CountsDoc {
  animals: Record<AnimalStatus | 'total', number>
  applications: Record<ApplicationStatus | 'total', number>
}

export async function getCounts(): Promise<CountsDoc | null> {
  const snap = await getDoc(doc(db, 'metadata', 'counts'))
  if (!snap.exists()) return null
  return snap.data() as CountsDoc
}
