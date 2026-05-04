import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { resolveUserProfile } from '../services/auth.service'
import type { UserProfile } from '@/types/common'

interface AuthContextValue {
  user: User | null
  userProfile: UserProfile | null
  authLoading: boolean
  profileLoading: boolean
  profileResolved: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileResolved, setProfileResolved] = useState(false)

  useEffect(() => {
    let active = true
    let requestId = 0

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const currentRequestId = ++requestId

      setUser(firebaseUser)

      if (!firebaseUser) {
        setUserProfile(null)
        setProfileLoading(false)
        setProfileResolved(true)
        setAuthLoading(false)
        return
      }

      setUserProfile(null)
      setProfileLoading(true)
      setProfileResolved(false)
      setAuthLoading(false)

      void (async () => {
        try {
          const profile = await resolveUserProfile(firebaseUser)

          if (!active || currentRequestId !== requestId) {
            return
          }

          setUserProfile(profile)
        } catch (error) {
          if (!active || currentRequestId !== requestId) {
            return
          }

          console.error('Falha ao carregar o perfil do usuário.')
          if (import.meta.env.DEV) console.error(error)
          setUserProfile(null)
        } finally {
          if (active && currentRequestId === requestId) {
            setProfileLoading(false)
            setProfileResolved(true)
          }
        }
      })()
    })

    return () => {
      active = false
      requestId += 1
      unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, userProfile, authLoading, profileLoading, profileResolved }}>
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
