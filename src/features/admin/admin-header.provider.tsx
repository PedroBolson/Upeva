import { useCallback, useMemo, useState } from 'react'
import { AdminHeaderContext, defaultAdminHeader } from './admin-header.context'
import type { AdminHeaderConfig } from './admin-header.types'

export function AdminHeaderProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeaderState] = useState<AdminHeaderConfig>(defaultAdminHeader)
  const setHeader = useCallback((next: AdminHeaderConfig) => {
    setHeaderState(next)
  }, [])
  const resetHeader = useCallback(() => {
    setHeaderState(defaultAdminHeader)
  }, [])

  const value = useMemo(
    () => ({
      header,
      setHeader,
      resetHeader,
    }),
    [header, resetHeader, setHeader],
  )

  return (
    <AdminHeaderContext.Provider value={value}>
      {children}
    </AdminHeaderContext.Provider>
  )
}
