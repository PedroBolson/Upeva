import { useContext, useEffect } from 'react'
import { AdminHeaderContext, defaultAdminHeader } from '../admin-header.context'
import type { AdminHeaderConfig } from '../admin-header.types'

export function useAdminHeader() {
  const ctx = useContext(AdminHeaderContext)
  if (!ctx) throw new Error('useAdminHeader must be used inside AdminHeaderProvider')
  return ctx
}

export function useAdminPageHeader(config: AdminHeaderConfig) {
  const { setHeader, resetHeader } = useAdminHeader()

  useEffect(() => {
    setHeader({ ...defaultAdminHeader, ...config })
    return () => resetHeader()
  }, [config, resetHeader, setHeader])
}
