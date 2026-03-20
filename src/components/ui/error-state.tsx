import { AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from './button'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Algo deu errado',
  description = 'Ocorreu um erro inesperado. Tente novamente.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-danger/10 p-4">
        <AlertCircle className="text-danger" size={28} strokeWidth={1.5} />
      </div>

      <div className="flex flex-col gap-1.5 max-w-xs">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
