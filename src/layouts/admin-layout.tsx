import { useEffect, useEffectEvent, useState } from 'react'
import { Navigate, Outlet, NavLink, Link, useLocation, useNavigate, ScrollRestoration } from 'react-router-dom'
import {
  LayoutDashboard,
  PawPrint,
  ClipboardList,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ChevronLeft,
  Users,
  Star,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Button, ThemeToggleButton, UniversityBadge } from '@/components/ui'
import { SystemBarTint } from '@/components/ui/system-bar-tint'
import { AdminHeaderProvider } from '@/features/admin/admin-header.provider'
import { useAdminHeader } from '@/features/admin/hooks/use-admin-header'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useAuthContext } from '@/features/auth/contexts/auth.context'
import { AdminListSkeleton, DashboardSkeleton } from '@/components/ui/skeleton'
import { isStandalone } from '@/utils/pwa'
import type { User } from 'firebase/auth'
import type { UserRole } from '@/types/common'

function getAuthLoadingSkeleton(pathname: string): React.ReactNode {
  if (pathname === '/admin') return <DashboardSkeleton />
  if (pathname === '/admin/animais') return <AdminListSkeleton columns={4} />
  if (pathname === '/admin/candidaturas') return <AdminListSkeleton columns={6} />
  if (pathname === '/admin/usuarios') return <AdminListSkeleton columns={3} />
  return null
}

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, role: undefined as UserRole | undefined },
  { to: '/admin/animais', label: 'Animais', icon: PawPrint, end: false, role: undefined as UserRole | undefined },
  { to: '/admin/destaques', label: 'Destaques', icon: Star, end: false, role: undefined as UserRole | undefined },
  { to: '/admin/candidaturas', label: 'Candidaturas', icon: ClipboardList, end: false, role: undefined as UserRole | undefined },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users, end: false, role: 'admin' as UserRole },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings, end: false, role: undefined as UserRole | undefined },
]

interface AdminSidebarProps {
  collapsed: boolean
  onCollapse: (value: boolean) => void
  onNavigate?: () => void
  user: User | null
  userRole: UserRole | undefined
  onLogout: () => void
}

function AdminSidebar({
  collapsed,
  onCollapse,
  onNavigate,
  user,
  userRole,
  onLogout,
}: AdminSidebarProps) {
  const visibleItems = navItems.filter((item) => !item.role || item.role === userRole)
  const navigate = useNavigate()
  const standalone = isStandalone()

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-border bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-52',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {collapsed ? (
          <div className="flex w-full justify-center">
            <PawPrint size={20} className="text-primary" />
          </div>
        ) : (
          <>
            <Link
              to="/admin"
              onClick={onNavigate}
              className="flex items-center gap-2 font-bold text-primary"
              aria-label="Dashboard"
            >
              <PawPrint size={20} />
              <span>Upeva</span>
            </Link>
            <button
              onClick={() => onCollapse(true)}
              aria-label="Recolher sidebar"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav aria-label="Menu administrativo" className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="flex flex-col gap-1">
          {visibleItems.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    collapsed && 'justify-center px-2',
                  )
                }
                title={collapsed ? label : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 flex flex-col gap-2">
        {!collapsed && <UniversityBadge variant="sidebar" />}
        {!collapsed && user && (
          <div className="px-2 py-1">
            <p className="text-xs font-medium text-foreground truncate">
              {user.displayName ?? user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <div className={cn('flex gap-2', collapsed ? 'flex-col' : 'grid grid-cols-2')}>
          <a
            href="/"
            target={standalone ? undefined : '_blank'}
            rel={standalone ? undefined : 'noopener noreferrer'}
            onClick={(event) => {
              onNavigate?.()

              if (!standalone) {
                return
              }

              event.preventDefault()
              navigate('/')
            }}
            className={cn(
              'flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground',
              'transition-colors duration-150 hover:border-primary/30 hover:bg-accent/60 hover:text-foreground',
              collapsed ? 'justify-center px-2' : 'justify-center',
            )}
            title={collapsed ? 'Abrir site' : undefined}
            aria-label={standalone ? 'Abrir site principal' : 'Abrir site principal em nova aba'}
          >
            <ExternalLink size={16} className="shrink-0" />
            {!collapsed && <span className="text-xs whitespace-nowrap">Abrir site</span>}
          </a>
          <button
            onClick={() => {
              onNavigate?.()
              onLogout()
            }}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground',
              'hover:text-danger hover:bg-danger/10 transition-colors duration-150 w-full',
              collapsed ? 'justify-center px-2' : 'justify-center',
            )}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminLayout() {
  const { user, authLoading } = useAuthContext()
  const location = useLocation()

  if (!authLoading && !user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return (
    <AdminHeaderProvider>
      <AdminLayoutContent authLoading={authLoading} />
    </AdminHeaderProvider>
  )
}

function AdminLayoutContent({ authLoading }: { authLoading: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { user, userProfile, logout } = useAuth()
  const { header } = useAdminHeader()
  const closeSidebar = useEffectEvent(() => setSidebarOpen(false))

  useEffect(() => {
    closeSidebar()
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <SystemBarTint tone="surface" />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Ir para o conteúdo
      </a>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-full shrink-0">
        <AdminSidebar
          collapsed={collapsed}
          onCollapse={setCollapsed}
          user={user}
          userRole={userProfile?.role}
          onLogout={logout}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="fixed left-0 top-0 z-50 h-full w-52 md:hidden"
            >
              <AdminSidebar
                collapsed={false}
                onCollapse={() => setSidebarOpen(false)}
                onNavigate={() => setSidebarOpen(false)}
                user={user}
                userRole={userProfile?.role}
                onLogout={logout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="relative z-20 h-16 shrink-0 border-b border-border bg-card">
          <div className="flex h-full items-center gap-2 px-4 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 md:hidden"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>

            {collapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-9 w-9 shrink-0 md:inline-flex"
                onClick={() => setCollapsed(false)}
                aria-label="Expandir menu"
              >
                <ChevronLeft size={16} className="rotate-180" />
              </Button>
            )}

            <div className="min-w-0 flex-1">
              {header.actions}
            </div>

            <ThemeToggleButton className="h-9 w-9 shrink-0" />
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-7xl px-4 pt-4 pb-[max(4rem,calc(2.5rem+env(safe-area-inset-bottom,0px)))] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <ScrollRestoration />
              {authLoading ? getAuthLoadingSkeleton(location.pathname) : <Outlet />}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}
