import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, ScrollRestoration, useLocation } from 'react-router-dom'
import { Menu, X, PawPrint, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Button, ThemeToggleButton, UniversityBadge } from '@/components/ui'
import { SystemBarTint, type SystemBarTone } from '@/components/ui/system-bar-tint'

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/animais', label: 'Animais', end: false },
  { to: '/sobre', label: 'Sobre', end: false },
  { to: '/contato', label: 'Contato', end: false },
]

interface PublicLayoutProps {
  children?: React.ReactNode
}

const heroSystemBarPaths = new Set(['/', '/sobre', '/contato'])

export function PublicLayout({ children }: PublicLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  // Frozen so iOS scroll events fired during menu-open animation don't switch styles mid-flight.
  const [heroOnOpen, setHeroOnOpen] = useState(false)
  const [scrolled, setScrolled] = useState(() =>
    typeof window !== 'undefined' ? window.scrollY > 8 : false,
  )
  const location = useLocation()

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Light/cream navbar only when the user is on the home page AND exactly at the top.
  // Any scroll immediately returns to normal theme-aware behavior.
  const isHeroNavbar = location.pathname === '/' && !scrolled

  // For the mobile hamburger and menu panel, use the state captured at open time so that
  // spurious scroll events from iOS Safari during the Framer Motion animation don't flip
  // the styling mid-flight. Desktop nav uses isHeroNavbar directly (hidden on mobile anyway).
  const mobileMenuIsHero = menuOpen ? heroOnOpen : isHeroNavbar

  const systemBarTone: SystemBarTone =
    !scrolled && heroSystemBarPaths.has(location.pathname) ? 'publicHero' : 'background'

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SystemBarTint tone={systemBarTone} />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Ir para o conteúdo
      </a>
      <header
        className={cn(
          'fixed top-0 z-40 w-full transition-[background-color,backdrop-filter,box-shadow] duration-300',
          scrolled ? 'bg-background/80 backdrop-blur-md shadow-sm' : 'bg-transparent',
        )}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-6">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 font-bold text-xl text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              aria-label="Upeva — Página inicial"
            >
              <PawPrint size={24} strokeWidth={2} />
              <span>Upeva</span>
            </Link>

            {/* Desktop nav */}
            <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                      isHeroNavbar
                        ? isActive
                          ? 'text-primary bg-[#f0e4d0]'
                          : 'text-[#2d1f0e] hover:text-[#1c1208] hover:bg-[#ede0cc]'
                        : isActive
                        ? 'text-primary bg-accent'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {/* Force dark icon color in hero mode so it stays visible on the cream background */}
              <span
                className={cn(
                  isHeroNavbar && '[&_button]:text-[#2d1f0e] [&_button:hover]:bg-[#ede0cc]',
                )}
              >
                <ThemeToggleButton />
              </span>

              <Link to="/adotar" className="hidden md:block">
                <Button size="sm" className="gap-1.5">
                  <Heart size={14} />
                  Quero adotar
                </Button>
              </Link>

              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                className={cn('md:hidden', mobileMenuIsHero && 'hover:bg-[#ede0cc]')}
                style={mobileMenuIsHero ? { color: '#2d1f0e' } : undefined}
                onClick={() => {
                  if (!menuOpen) setHeroOnOpen(isHeroNavbar)
                  setMenuOpen((o) => !o)
                }}
                aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className={cn(
                'md:hidden overflow-hidden border-t',
                mobileMenuIsHero ? 'border-[#d4b896] bg-[#fdf8f0]' : 'border-border bg-background',
              )}
            >
              <nav
                aria-label="Menu mobile"
                className="flex flex-col gap-1 px-4 py-3"
              >
                {navLinks.map(({ to, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                        mobileMenuIsHero
                          ? isActive
                            ? 'text-primary bg-[#f0e4d0]'
                            : 'text-[#2d1f0e] hover:bg-[#ede0cc]'
                          : isActive
                          ? 'text-primary bg-accent'
                          : 'text-foreground hover:bg-accent',
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ))}
                <div className="pt-2 pb-1">
                  <Link to="/adotar" onClick={() => setMenuOpen(false)}>
                    <Button size="sm" className="w-full gap-1.5">
                      <Heart size={14} />
                      Quero adotar
                    </Button>
                  </Link>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <ScrollRestoration />
      <main id="main-content" className="flex-1">
        {children ?? <Outlet />}
      </main>

      <footer className="border-t border-border bg-muted/50 mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 text-primary font-bold text-lg">
                <img
                  src="/upeva.jpg"
                  alt="Logo da Upeva"
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-background shadow-sm"
                />
                <div className="flex flex-col">
                  <span>Upeva</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    União Pela Vida Animal
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row">
                <Link to="/sobre" className="hover:text-foreground transition-colors">
                  Sobre a ONG
                </Link>
                <Link to="/contato" className="hover:text-foreground transition-colors">
                  Contato
                </Link>
                <Link to="/animais" className="hover:text-foreground transition-colors">
                  Animais
                </Link>
                <Link to="/adotar" className="hover:text-foreground transition-colors">
                  Formulário de adoção
                </Link>
                <Link to="/termos-de-uso" className="hover:text-foreground transition-colors">
                  Termos de Uso
                </Link>
                <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">
                  Privacidade
                </Link>
              </div>
            </div>

            <div className="mt-2 border-t border-border pt-6 grid grid-cols-1 gap-4 text-xs text-muted-foreground sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <span className="text-left">© {new Date().getFullYear()} Upeva — Feito com amor.</span>

              <UniversityBadge variant="footer" className="sm:justify-self-center" />

              <div className="sm:justify-self-end">
                <Link to="/admin/login" className="hover:text-foreground transition-colors">
                  Área restrita
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
