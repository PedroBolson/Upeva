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
import { isStaffRole } from '../utils/roles'

const profileResolutionPromises = new Map<
  string,
  { user: User; promise: Promise<UserProfile | null> }
>()

export async function signIn(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  const profile = await resolveUserProfile(user)

  if (!profile || !isStaffRole(profile.role)) {
    await firebaseSignOut(auth)
    throw new Error('Acesso não autorizado.')
  }

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

export async function resolveUserProfile(user: User): Promise<UserProfile | null> {
  const existingResolution = profileResolutionPromises.get(user.uid)
  if (existingResolution?.user === user) return existingResolution.promise

  const resolutionPromise = resolveUserProfileAndClaims(user)
  profileResolutionPromises.set(user.uid, { user, promise: resolutionPromise })

  try {
    return await resolutionPromise
  } finally {
    if (profileResolutionPromises.get(user.uid)?.promise === resolutionPromise) {
      profileResolutionPromises.delete(user.uid)
    }
  }
}

async function resolveUserProfileAndClaims(user: User): Promise<UserProfile | null> {
  const profile = await getUserProfile(user.uid)

  if (profile && isStaffRole(profile.role)) {
    await ensureRoleClaim(user, profile.role)
  }

  return profile
}

async function ensureRoleClaim(user: User, role: UserProfile['role']): Promise<void> {
  const tokenResult = await user.getIdTokenResult()

  if (tokenResult.claims.role === role) {
    return
  }

  await refreshUserClaims()
  await user.getIdToken(true)

  const refreshedTokenResult = await user.getIdTokenResult(true)
  if (refreshedTokenResult.claims.role !== role) {
    throw new Error('Não foi possível atualizar as permissões da sessão.')
  }
}
