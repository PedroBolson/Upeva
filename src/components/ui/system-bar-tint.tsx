import type { CSSProperties } from 'react'
import { useLayoutEffect } from 'react'
import { useTheme } from '@/app/theme-provider'
import { cn } from '@/utils/cn'

export type SystemBarTone = 'background' | 'surface' | 'publicHero' | 'launch'

const META_THEME_SELECTOR = 'meta[name="theme-color"]'

const toneToCssVar: Record<SystemBarTone, string> = {
  background: '--system-bar-background',
  surface: '--system-bar-surface',
  publicHero: '--system-bar-public-hero',
  launch: '--system-bar-launch',
}

const fallbackThemeColors = {
  light: {
    background: 'rgb(249, 248, 245)',
    surface: 'rgb(255, 255, 255)',
    publicHero: '#f3eadc',
    launch: '#f3eadc',
  },
  dark: {
    background: 'rgb(27, 22, 20)',
    surface: 'rgb(45, 40, 36)',
    publicHero: '#352b22',
    launch: '#352b22',
  },
} as const

function getSystemBarColor(
  tone: SystemBarTone,
  resolvedTheme: 'light' | 'dark',
) {
  const styles = getComputedStyle(document.documentElement)
  const cssVarColor = styles.getPropertyValue(toneToCssVar[tone]).trim()

  return cssVarColor || fallbackThemeColors[resolvedTheme][tone]
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
    if (!metaTheme) {
      return
    }

    const color = getSystemBarColor(tone, resolvedTheme)
    if (!color) {
      return
    }

    const nextMetaTheme = metaTheme.cloneNode() as HTMLMetaElement
    nextMetaTheme.setAttribute('name', 'theme-color')
    nextMetaTheme.setAttribute('content', color)
    metaTheme.replaceWith(nextMetaTheme)

    const rafId = window.requestAnimationFrame(() => {
      const latestMetaTheme = document.querySelector<HTMLMetaElement>(META_THEME_SELECTOR)
      latestMetaTheme?.setAttribute('content', color)
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [tone, resolvedTheme])

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-x-0 top-0 z-60', className)}
      style={{
        height: 'env(safe-area-inset-top, 0px)',
        ...(className ? {} : { backgroundColor: `var(${toneToCssVar[tone]})` }),
        ...style,
      }}
    />
  )
}
