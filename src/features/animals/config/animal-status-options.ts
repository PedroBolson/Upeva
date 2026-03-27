import type { AnimalStatus } from '@/types/common'

export const ANIMAL_STATUS_OPTIONS: Array<{ value: AnimalStatus; label: string }> = [
  { value: 'available', label: 'Disponível' },
  { value: 'under_review', label: 'Em análise' },
  { value: 'adopted', label: 'Adotado' },
  { value: 'archived', label: 'Arquivado' },
]
