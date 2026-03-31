import { Navigate, useLocation } from 'react-router-dom'
import { isInitialStandaloneEntry } from '@/utils/pwa'
import { useAuthContext } from '../contexts/auth.context'
import { SystemBarTint } from '@/components/ui/system-bar-tint'
import { HomePage } from '@/pages/public/home'
import { PublicLayout } from '@/layouts/public-layout'

export function SmartEntry() {
  const { user, authLoading } = useAuthContext()
  const location = useLocation()
  const initialStandaloneEntry = isInitialStandaloneEntry(location.key)

  if (initialStandaloneEntry && authLoading) {
    return <PwaEntryScreen />
  }

  if (user && initialStandaloneEntry) {
    return <Navigate to="/admin" replace />
  }

  return (
    <PublicLayout>
      <HomePage />
    </PublicLayout>
  )
}

function PwaEntryScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-accent via-background to-background">
      <SystemBarTint
        tone="publicHero"
        className="bg-linear-to-br from-accent via-background to-background"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl"
      />

      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-[1.75rem] border border-primary/15 bg-background/80 p-3 shadow-lg backdrop-blur-sm">
            <img
              src="/upeva.jpg"
              alt="Logo da Upeva"
              className="h-16 w-16 rounded-2xl object-cover ring-1 ring-primary/10"
            />
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">Upeva</p>
            <p className="text-sm font-medium text-muted-foreground">União Pela Vida Animal</p>
            <p className="text-base text-foreground/80">Bem-vindo</p>
          </div>
        </div>
      </div>
    </div>
  )
}
