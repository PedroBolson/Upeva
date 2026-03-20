import { createContext } from 'react'
import type { AdminHeaderConfig } from './admin-header.types'

export interface AdminHeaderContextValue {
  header: AdminHeaderConfig
  setHeader: (header: AdminHeaderConfig) => void
  resetHeader: () => void
}

export const defaultAdminHeader: AdminHeaderConfig = {}

export const AdminHeaderContext = createContext<AdminHeaderContextValue | null>(null)
