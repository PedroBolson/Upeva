import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
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

export async function recalibrateCounts(): Promise<CountsDoc> {
  const fn = httpsCallable<void, CountsDoc>(functions, 'recalibrateCounts')
  const result = await fn()
  return result.data
}

export async function recalibrateQueuePositions(): Promise<{ updatedCount: number }> {
  const fn = httpsCallable<void, { updatedCount: number }>(functions, 'recalibrateQueuePositions')
  const result = await fn()
  return result.data
}
