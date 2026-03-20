import { useState } from 'react'
import { signIn, signOut, resetPassword } from '../services/auth.service'
import { useAuthContext } from '../contexts/auth.context'

export function useAuth() {
  const { user, userProfile, loading } = useAuthContext()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function login(email: string, password: string): Promise<boolean> {
    setSigningIn(true)
    setError(null)
    try {
      await signIn(email, password)
      return true
    } catch (err) {
      setError(getAuthErrorMessage(err))
      return false
    } finally {
      setSigningIn(false)
    }
  }

  async function logout(): Promise<void> {
    await signOut()
  }

  async function sendPasswordReset(email: string): Promise<void> {
    await resetPassword(email)
  }

  return { user, userProfile, loading, signingIn, error, login, logout, sendPasswordReset }
}

function getAuthErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('não autorizado')) return err.message
    if (err.message.includes('invalid-credential') || err.message.includes('wrong-password')) {
      return 'Email ou senha inválidos.'
    }
    if (err.message.includes('too-many-requests')) {
      return 'Muitas tentativas. Tente novamente mais tarde.'
    }
    if (err.message.includes('user-not-found')) {
      return 'Usuário não encontrado.'
    }
  }
  return 'Ocorreu um erro. Tente novamente.'
}
