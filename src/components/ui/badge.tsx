import { cn } from '@/utils/cn'
import type { AnimalStatus, ApplicationStatus } from '@/types/common'

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'accent'
  | 'outline'
  | 'success'
  | 'warning'
  | 'danger'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default:   'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  accent:    'bg-accent text-accent-foreground',
  outline:   'border border-border bg-transparent text-foreground',
  success:   'bg-success text-success-foreground',
  warning:   'bg-warning text-warning-foreground',
  danger:    'bg-danger text-danger-foreground',
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}

const animalStatusMap: Record<AnimalStatus, { label: string; variant: BadgeVariant }> = {
  available:    { label: 'Disponível',    variant: 'success' },
  under_review: { label: 'Em análise',    variant: 'warning' },
  adopted:      { label: 'Adotado',       variant: 'secondary' },
  archived:     { label: 'Arquivado',     variant: 'outline' },
}

const applicationStatusMap: Record<ApplicationStatus, { label: string; variant: BadgeVariant }> = {
  pending:    { label: 'Pendente',    variant: 'warning' },
  in_review:  { label: 'Em análise', variant: 'default' },
  approved:   { label: 'Aprovada',   variant: 'success' },
  rejected:   { label: 'Rejeitada',  variant: 'danger' },
  withdrawn:  { label: 'Desistência', variant: 'outline' },
  declined:   { label: 'Declinada',  variant: 'secondary' },
}

export function AnimalStatusBadge({ status }: { status: AnimalStatus }) {
  const { label, variant } = animalStatusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, variant } = applicationStatusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}
