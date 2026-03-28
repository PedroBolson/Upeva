import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '@/lib/firebase'
import type { UserProfile } from '@/types/common'

export async function signIn(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  await assertIsStaff(user.uid)
  return user
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

export async function confirmReset(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPassword)
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

export async function refreshUserClaims(): Promise<void> {
  const fn = httpsCallable(functions, 'refreshUserClaims')
  await fn({})
}

async function assertIsStaff(uid: string): Promise<void> {
  const profile = await getUserProfile(uid)
  if (!profile || !['admin', 'reviewer'].includes(profile.role)) {
    await firebaseSignOut(auth)
    throw new Error('Acesso não autorizado.')
  }
}
