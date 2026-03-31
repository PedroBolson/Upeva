import type { CSSProperties } from 'react'
import { useEffect } from 'react'
import { useTheme } from '@/app/theme-provider'
import { cn } from '@/utils/cn'

export type SystemBarTone = 'background' | 'surface' | 'publicHero'

const META_THEME_SELECTOR = 'meta[name="theme-color"]'

const toneToCssVar: Record<SystemBarTone, string> = {
  background: '--system-bar-background',
  surface: '--system-bar-surface',
  publicHero: '--system-bar-public-hero',
}

function getSystemBarColor(tone: SystemBarTone) {
  const styles = getComputedStyle(document.documentElement)
  return styles.getPropertyValue(toneToCssVar[tone]).trim()
}

interface SystemBarTintProps {
  tone: SystemBarTone
  className?: string
  style?: CSSProperties
}

export function SystemBarTint({ tone, className, style }: SystemBarTintProps) {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const metaTheme = document.querySelector<HTMLMetaElement>(META_THEME_SELECTOR)
    if (!metaTheme) {
      return
    }

    const color = getSystemBarColor(tone)
    if (!color) {
      return
    }

    metaTheme.setAttribute('content', color)
  }, [tone, resolvedTheme])

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-x-0 top-0 z-[60]', className)}
      style={{
        height: 'env(safe-area-inset-top, 0px)',
        ...(className ? {} : { backgroundColor: `var(${toneToCssVar[tone]})` }),
        ...style,
      }}
    />
  )
}
