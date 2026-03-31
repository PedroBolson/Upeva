import { useEffect } from 'react'

const PUBLIC_BRAND = 'Upeva'
const PUBLIC_HOME_TITLE = 'Upeva - União Pela Vida Animal'
const ADMIN_BRAND = 'Administração Upeva'

export function buildPublicTitle(section?: string): string {
  return section ? `${PUBLIC_BRAND} - ${section}` : PUBLIC_HOME_TITLE
}

export function buildAdminTitle(section: string): string {
  return `${ADMIN_BRAND} - ${section}`
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
