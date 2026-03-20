import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { Menu, X, PawPrint, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { Button, ThemeToggleButton } from '@/components/ui'

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/animais', label: 'Animais', end: false },
  { to: '/sobre', label: 'Sobre', end: false },
  { to: '/contato', label: 'Contato', end: false },
]

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 12)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header
        className={cn(
          'sticky top-0 z-40 w-full transition-all duration-200',
          scrolled
            ? 'border-b border-border bg-background/80 backdrop-blur-md shadow-sm'
            : 'bg-background',
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
                      isActive
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
              <ThemeToggleButton />

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
                className="md:hidden"
                onClick={() => setMenuOpen((o) => !o)}
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
              className="md:hidden overflow-hidden border-t border-border bg-background"
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
                        isActive
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

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-muted/50 mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
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
            <div className="flex flex-col sm:flex-row gap-4 text-sm text-muted-foreground">
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
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-6 flex items-center justify-between text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Upeva — Feito com amor.</span>
            <Link to="/admin/login" className="hover:text-foreground transition-colors">
              Área restrita
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
