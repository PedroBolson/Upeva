import { Navigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '../contexts/auth.context'
import { PageSpinner } from '@/components/ui'
import type { UserRole } from '@/types/common'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, userProfile, authLoading, profileLoading } = useAuthContext()
  const location = useLocation()

  if (authLoading) return <PageSpinner />

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (requiredRole && profileLoading) {
    return <PageSpinner />
  }

  if (requiredRole && userProfile?.role !== requiredRole) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
