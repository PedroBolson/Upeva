import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useToastItems, type ToastItem } from './toast'

const VARIANT_CONFIG: Record<
  ToastItem['variant'],
  { borderClass: string; Icon: React.ElementType; iconClass: string }
> = {
  success: { borderClass: 'border-success/40', Icon: CheckCircle2, iconClass: 'text-success' },
  error:   { borderClass: 'border-danger/40',  Icon: AlertCircle,   iconClass: 'text-danger'  },
  warning: { borderClass: 'border-warning/40', Icon: AlertTriangle, iconClass: 'text-warning' },
  info:    { borderClass: 'border-primary/40', Icon: Info,          iconClass: 'text-primary' },
}

function ToastEntry({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  const { borderClass, Icon, iconClass } = VARIANT_CONFIG[item.variant]
  const isDestructive = item.variant === 'error' || item.variant === 'warning'

  useEffect(() => {
    const timer = setTimeout(onRemove, item.duration)
    return () => clearTimeout(timer)
  }, [item.duration, onRemove])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      role={isDestructive ? 'alert' : 'status'}
      aria-live={isDestructive ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-xl',
        'w-80 max-w-[calc(100vw-2rem)]',
        borderClass,
      )}
    >
      <Icon size={16} className={cn('mt-0.5 shrink-0', iconClass)} aria-hidden="true" />
      <span className="flex-1 text-sm leading-snug text-foreground">{item.message}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Fechar notificação"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}

export function Toaster() {
  const { toasts, dispatch } = useToastItems()

  return createPortal(
    <div
      aria-label="Notificações"
      className="fixed bottom-4 left-1/2 z-[9999] flex -translate-x-1/2 flex-col-reverse items-center gap-2 sm:left-auto sm:right-4 sm:translate-x-0 sm:items-end"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastEntry
            key={t.id}
            item={t}
            onRemove={() => dispatch({ type: 'REMOVE', id: t.id })}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
