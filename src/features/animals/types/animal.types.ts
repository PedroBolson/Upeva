import type { Timestamp, Species, Sex, Size, AnimalStatus, ArchiveReason } from '@/types/common'

export interface Animal {
  id: string
  name: string
  species: Species
  sex: Sex
  size?: Size
  breed?: string
  estimatedAge?: string
  description: string
  photos: string[]
  coverPhotoIndex: number
  status: AnimalStatus
  vaccines: string[]
  neutered: boolean
  specialNeeds?: string
  adoptedApplicationId?: string
  adoptedAt?: Timestamp
  activeApplicationCount?: number
  archiveReason?: ArchiveReason
  archiveDetails?: string
  archiveDate?: string
  archivedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface AnimalFilters {
  species?: Species
  sex?: Sex
  size?: Size
  search?: string
}

export const SPECIES_LABELS: Record<Species, string> = {
  dog: 'Cachorro',
  cat: 'Gato',
}

export const SEX_LABELS: Record<Sex, string> = {
  male: 'Macho',
  female: 'Fêmea',
}

export const SIZE_LABELS: Record<Size, string> = {
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
}

export const STATUS_LABELS: Record<AnimalStatus, string> = {
  available: 'Disponível',
  under_review: 'Em análise',
  adopted: 'Adotado',
  archived: 'Arquivado',
}
