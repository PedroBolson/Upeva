import type { ApplicationStatus } from '@/types/common'

// Used in the triagem select — rejected/declined go through the rejection modal, not this select
export const APPLICATION_STATUS_OPTIONS: Array<{ value: ApplicationStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_review', label: 'Em análise' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'withdrawn', label: 'Retirada' },
]

export const APPLICATION_STATUS_TABS: Array<{ value: ApplicationStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'in_review', label: 'Em análise' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'rejected', label: 'Rejeitadas' },
  { value: 'withdrawn', label: 'Retiradas' },
]
