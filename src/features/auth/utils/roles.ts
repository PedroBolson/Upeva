import type { UserRole } from '@/types/common'

export const STAFF_ROLES = ['admin', 'reviewer'] as const satisfies readonly UserRole[]

export function isStaffRole(role: UserRole | null | undefined): role is UserRole {
  return role === 'admin' || role === 'reviewer'
}

export function isRoleAllowed(
  role: UserRole | null | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  return Boolean(role && allowedRoles.includes(role))
}
