import { Navigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '../contexts/auth.context'
import { ErrorState, PageSpinner } from '@/components/ui'
import { isRoleAllowed } from '@/features/auth/utils/roles'
import type { UserRole } from '@/types/common'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
  allowedRoles?: readonly UserRole[]
  redirectDeniedTo?: string
}

function AccessDeniedState() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <ErrorState
        title="Acesso negado"
        description="Sua conta não tem permissão para acessar esta área."
      />
    </div>
  )
}

export function ProtectedRoute({
  children,
  requiredRole,
  allowedRoles,
  redirectDeniedTo,
}: ProtectedRouteProps) {
  const { user, userProfile, authLoading, profileLoading } = useAuthContext()
  const location = useLocation()
  const routeRoles = allowedRoles ?? (requiredRole ? [requiredRole] : undefined)

  if (authLoading) return <PageSpinner />

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (routeRoles && profileLoading) {
    return <PageSpinner />
  }

  if (routeRoles && !isRoleAllowed(userProfile?.role, routeRoles)) {
    if (redirectDeniedTo) {
      return <Navigate to={redirectDeniedTo} replace />
    }

    return <AccessDeniedState />
  }

  return <>{children}</>
}
