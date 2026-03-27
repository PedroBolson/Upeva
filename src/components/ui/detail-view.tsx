import { cn } from '@/utils/cn'

export interface DetailSectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function DetailSection({ title, children, className }: DetailSectionProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 flex flex-col gap-4', className)}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

export interface DetailFieldProps {
  label: string
  value?: React.ReactNode
  className?: string
}

export function DetailField({ label, value, className }: DetailFieldProps) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground wrap-break-words whitespace-pre-wrap">
        {value ?? '—'}
      </span>
    </div>
  )
}
