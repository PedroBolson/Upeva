import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  startAfter,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import type { UserProfile, UserRole } from '@/types/common'

const USERS_PAGE_SIZE = 50

export interface UsersPage {
  users: UserProfile[]
  lastDoc: DocumentSnapshot | null
  hasMore: boolean
}

function docToProfile(id: string, data: Record<string, unknown>): UserProfile {
  return { uid: id, ...(data as Omit<UserProfile, 'uid'>) }
}

export async function getUsersPaginated(
  cursor: DocumentSnapshot | null = null,
): Promise<UsersPage> {
  const constraints = [
    orderBy('createdAt', 'asc'),
    limit(USERS_PAGE_SIZE + 1),
    ...(cursor ? [startAfter(cursor)] : []),
  ]
  const snap = await getDocs(query(collection(db, 'users'), ...constraints))
  const hasMore = snap.docs.length > USERS_PAGE_SIZE
  const docs = hasMore ? snap.docs.slice(0, USERS_PAGE_SIZE) : snap.docs
  return {
    users: docs.map((d) => docToProfile(d.id, d.data())),
    lastDoc: docs[docs.length - 1] ?? null,
    hasMore,
  }
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
