import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUserProfile, refreshUserClaims } from '../services/auth.service'
import type { UserProfile } from '@/types/common'

interface AuthContextValue {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // Ensure the token has the latest Custom Claims (role).
        // If absent (existing user before Custom Claims deployment), call
        // the Cloud Function to set the claim, then force a token refresh.
        const tokenResult = await firebaseUser.getIdTokenResult()
        if (!tokenResult.claims['role']) {
          await refreshUserClaims()
          await firebaseUser.getIdToken(true)
        }
        const profile = await getUserProfile(firebaseUser.uid)
        setUserProfile(profile)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
