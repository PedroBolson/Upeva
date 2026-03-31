import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/auth.context'
import { PageSpinner } from '@/components/ui'
import { HomePage } from '@/pages/public/home'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as Navigator & { standalone: boolean }).standalone === true)
  )
}

export function SmartEntry() {
  const { user, loading } = useAuthContext()

  if (loading) return <PageSpinner />
  if (user && isStandalone()) return <Navigate to="/admin" replace />

  return <HomePage />
}
