import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import type { UserProfile, UserRole } from '@/types/common'

function docToProfile(id: string, data: Record<string, unknown>): UserProfile {
  return { uid: id, ...(data as Omit<UserProfile, 'uid'>) }
}

export async function getUsers(): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToProfile(d.id, d.data()))
}

export interface CreateUserPayload {
  email: string
  password: string
  displayName: string
  role: UserRole
}

export async function createUser(payload: CreateUserPayload): Promise<string> {
  const fn = httpsCallable<CreateUserPayload, { uid: string }>(functions, 'createUser')
  const result = await fn(payload)
  return result.data.uid
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  const fn = httpsCallable<{ uid: string; role: UserRole }, { success: boolean }>(
    functions,
    'updateUserRole',
  )
  await fn({ uid, role })
}
