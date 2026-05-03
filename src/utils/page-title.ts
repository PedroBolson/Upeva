import { useEffect } from 'react'

const PUBLIC_BRAND = 'Upeva'
const PUBLIC_HOME_TITLE = 'Upeva - União Pela Vida Animal'
const ADMIN_BRAND = 'Administração Upeva'
const DEFAULT_DESCRIPTION =
  'A Upeva conecta cães e gatos resgatados a famílias responsáveis em Flores da Cunha e região.'
const DEFAULT_OG_IMAGE = '/upeva.jpg'
const DEFAULT_OG_IMAGE_ALT = 'Logo da Upeva - União Pela Vida Animal'
const SITE_NAME = 'Upeva'

export function buildPublicTitle(section?: string): string {
  return section ? `${PUBLIC_BRAND} - ${section}` : PUBLIC_HOME_TITLE
}

export function buildAdminTitle(section: string): string {
  return `${ADMIN_BRAND} - ${section}`
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
    if (window.location.pathname.startsWith('/admin')) {
      setMeta('name', 'robots', 'noindex, nofollow')
      removeCanonical()
      return
    }

    const canonicalUrl = buildAbsoluteUrl(window.location.pathname)
    const imageUrl = buildAbsoluteUrl(DEFAULT_OG_IMAGE) ?? DEFAULT_OG_IMAGE

    setMeta('name', 'description', DEFAULT_DESCRIPTION)
    setMeta('name', 'robots', 'index, follow')
    setMeta('property', 'og:site_name', SITE_NAME)
    setMeta('property', 'og:locale', 'pt_BR')
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', DEFAULT_DESCRIPTION)
    setMeta('property', 'og:image', imageUrl)
    setMeta('property', 'og:image:alt', DEFAULT_OG_IMAGE_ALT)
    if (canonicalUrl) {
      setMeta('property', 'og:url', canonicalUrl)
      setCanonical(canonicalUrl)
    }
    setMeta('name', 'twitter:card', 'summary')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', DEFAULT_DESCRIPTION)
    setMeta('name', 'twitter:image', imageUrl)
    setMeta('name', 'twitter:image:alt', DEFAULT_OG_IMAGE_ALT)
  }, [title])
}

interface PageSeoOptions {
  title: string
  description?: string
  path?: string
  image?: string
  imageAlt?: string
  type?: 'website' | 'article' | 'profile'
  noindex?: boolean
}

export function usePageSeo({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image = DEFAULT_OG_IMAGE,
  imageAlt = DEFAULT_OG_IMAGE_ALT,
  type = 'website',
  noindex = false,
}: PageSeoOptions) {
  useEffect(() => {
    const canonicalUrl = noindex ? undefined : buildAbsoluteUrl(path ?? window.location.pathname)
    const imageUrl = buildAbsoluteUrl(image) ?? image

    document.title = title

    setMeta('name', 'description', description)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')

    setMeta('property', 'og:site_name', SITE_NAME)
    setMeta('property', 'og:locale', 'pt_BR')
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:image', imageUrl)
    setMeta('property', 'og:image:alt', imageAlt)
    if (canonicalUrl) {
      setMeta('property', 'og:url', canonicalUrl)
      setCanonical(canonicalUrl)
    } else {
      removeCanonical()
    }

    setMeta('name', 'twitter:card', 'summary')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', imageUrl)
    setMeta('name', 'twitter:image:alt', imageAlt)
  }, [description, image, imageAlt, noindex, path, title, type])
}

function getConfiguredOrigin(): string | undefined {
  return normalizeOrigin(import.meta.env.VITE_SITE_URL)
}

function getCurrentOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return normalizeOrigin(window.location.origin)
}

function buildAbsoluteUrl(path: string): string | undefined {
  const origin = getConfiguredOrigin() ?? getCurrentOrigin()
  if (!origin) return undefined

  try {
    return new URL(path, origin).href
  } catch {
    return undefined
  }
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

function setCanonical(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}

function removeCanonical() {
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.remove()
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`
  let meta = document.querySelector<HTMLMetaElement>(selector)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute(attribute, key)
    document.head.appendChild(meta)
  }
  meta.content = content
}
