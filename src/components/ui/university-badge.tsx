import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'

interface TeamMember {
  name: string
  role: string
}

const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Catherine Chiappin Dutra', role: 'Professora' },
  { name: 'Deborah Raquel Fekete Herculano', role: 'Aluno' },
  { name: 'Emily da Silva Oliveira', role: 'Aluno' },
  { name: 'Lucas Risson', role: 'Aluno' },
  { name: 'Makélen Menta Belenzier', role: 'Aluno' },
  { name: 'Maria Eduarda Schubert Machado', role: 'Aluno' },
  { name: 'Pedro Assmann Bolson', role: 'Aluno' },
  { name: 'Sabrina Mombach dos Santos', role: 'Aluno' },
]

const HOVER_MEDIA = '(hover: hover) and (pointer: fine)'

export interface UniversityBadgeProps {
  variant?: 'footer' | 'sidebar'
  className?: string
}

export function UniversityBadge({ variant = 'footer', className }: UniversityBadgeProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleMouseEnter = useCallback(() => {
    if (window.matchMedia(HOVER_MEDIA).matches) setOpen(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (window.matchMedia(HOVER_MEDIA).matches) setOpen(false)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen((prev) => !prev)
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'cursor-pointer transition-colors',
          variant === 'footer'
            ? 'flex items-center gap-3 rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-muted-foreground shadow-sm hover:border-primary/40'
            : 'flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background/80 px-3 py-2 shadow-sm hover:border-primary/40',
        )}
      >
        {variant === 'footer' ? (
          <>
            <span className="font-medium">com apoio de</span>
            <img src="/logo.png" alt="Logo da universidade" className="h-10 w-auto object-contain" />
          </>
        ) : (
          <>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              com apoio
            </span>
            <img src="/logo.png" alt="Logo da universidade" className="h-8 w-auto object-contain" />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Equipe do projeto"
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute bottom-full z-50 mb-3 w-72 rounded-xl border border-border bg-card shadow-xl',
              variant === 'footer' ? 'left-1/2 -translate-x-1/2' : 'left-0',
            )}
          >
            <div
              className={cn(
                'absolute top-full h-3 w-3 -translate-y-[7px] rotate-45 border-b border-r border-border bg-card',
                variant === 'footer' ? 'left-1/2 -translate-x-1/2' : 'left-6',
              )}
            />

            <div className="p-4">
              <div className="mb-3 flex items-center gap-3 border-b border-border pb-3">
                <img src="/logo.png" alt="Logo da universidade" className="h-8 w-auto object-contain" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Equipe do Projeto</p>
                  <p className="text-[11px] text-muted-foreground">Upeva · {new Date().getFullYear()}</p>
                </div>
              </div>

              <ul role="list" className="flex flex-col gap-2.5">
                {TEAM_MEMBERS.map(({ name, role }) => (
                  <li key={name} className="flex items-center justify-between gap-2">
                    <span className="text-xs leading-snug text-foreground">{name}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        role === 'Professora'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
