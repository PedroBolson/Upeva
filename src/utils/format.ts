import type { Timestamp } from '@/types/common'

export function tsToDate(ts: Timestamp | undefined): Date {
  if (!ts) return new Date(0)
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts as unknown as number)
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim()
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatRelativeDate(value: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - value.getTime()

  if (diffMs < 0) return formatDate(value)

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays < 7) return `há ${diffDays} dias`

  const weeks = Math.floor(diffDays / 7)
  if (diffDays < 30) return `há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`

  const months = Math.floor(diffDays / 30)
  if (diffDays < 365) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`

  const years = Math.floor(diffDays / 365)
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`
}
