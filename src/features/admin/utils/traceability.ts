import type { Timestamp } from '@/types/common'

export function formatTraceDate(value: Timestamp | string | Date | undefined): string {
  if (!value) return 'Não registrado'

  const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date =
    typeof value === 'string'
      ? isDateOnly
        ? new Date(`${value}T00:00:00`)
        : new Date(value)
      : value instanceof Date
        ? value
        : typeof value.toDate === 'function'
          ? value.toDate()
          : new Date(value as unknown as number)

  if (Number.isNaN(date.getTime())) return 'Não registrado'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    ...(isDateOnly ? {} : { timeStyle: 'short' as const }),
  }).format(date)
}

export function formatActorLabel(label: string | undefined): string {
  return label?.trim() || 'Não registrado'
}
