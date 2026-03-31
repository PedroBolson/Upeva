export function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone: boolean }).standalone === true)
  )
}

export function isInitialStandaloneEntry(locationKey: string): boolean {
  return isStandalone() && locationKey === 'default'
}
