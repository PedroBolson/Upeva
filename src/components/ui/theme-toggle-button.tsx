import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/app/theme-provider'
import { Button } from './button'

interface ThemeToggleButtonProps {
  className?: string
}

export function ThemeToggleButton({ className }: ThemeToggleButtonProps) {
  const { resolvedTheme, setTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'
  const Icon = isDark ? Moon : Sun
  const nextTheme = isDark ? 'light' : 'dark'
  const ariaLabel = isDark
    ? 'Tema atual escuro. Ativar modo claro'
    : 'Tema atual claro. Ativar modo escuro'

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(nextTheme)}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Icon size={18} />
    </Button>
  )
}
