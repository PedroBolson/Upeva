import type { CSSProperties } from 'react'
import { useLayoutEffect } from 'react'
import { useTheme } from '@/app/theme-provider'
import { cn } from '@/utils/cn'

export type SystemBarTone = 'background' | 'surface' | 'publicHero' | 'launch'

const META_THEME_SELECTOR = 'meta[name="theme-color"]'

const toneToCssVar: Record<SystemBarTone, string> = {
  background: '--system-bar-background',
  surface:    '--system-bar-surface',
  publicHero: '--system-bar-public-hero',
  launch:     '--system-bar-launch',
}

// Espelham exatamente as CSS vars de index.css.
// Usamos os valores hardcoded para evitar race condition: useLayoutEffect roda
// bottom-up (filhos antes dos pais), então getComputedStyle poderia ser chamado
// antes de ThemeProvider adicionar a classe .dark no <html>.
const toneColors: Record<'light' | 'dark', Record<SystemBarTone, string>> = {
  light: {
    background: '#faf8f5',
    surface:    '#ffffff',
    publicHero: '#f3eadc',
    launch:     '#f3eadc',
  },
  dark: {
    background: '#231d1a',
    surface:    '#2e2824',
    publicHero: '#352b22',
    launch:     '#352b22',
  },
}

interface SystemBarTintProps {
  tone: SystemBarTone
  className?: string
  style?: CSSProperties
}

export function SystemBarTint({ tone, className, style }: SystemBarTintProps) {
  const { resolvedTheme } = useTheme()

  useLayoutEffect(() => {
    const metaTheme = document.querySelector<HTMLMetaElement>(META_THEME_SELECTOR)
    if (!metaTheme) return

    metaTheme.setAttribute('content', toneColors[resolvedTheme][tone])
  }, [tone, resolvedTheme])

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-x-0 top-0 z-60', className)}
      style={{
        height: 'env(safe-area-inset-top, 0px)',
        backgroundColor: `var(${toneToCssVar[tone]})`,
        ...style,
      }}
    />
  )
}
