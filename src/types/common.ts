import type { Timestamp } from 'firebase/firestore'

export type { Timestamp }

export type UserRole = 'admin' | 'reviewer'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  createdAt: Timestamp
  createdBy: string
}

export type Species = 'dog' | 'cat'
export type Sex = 'male' | 'female'
export type Size = 'small' | 'medium' | 'large'

export type AnimalStatus = 'available' | 'under_review' | 'adopted' | 'archived'

export type ApplicationStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'declined'

export type RejectionReason =
  | 'inadequate_housing'
  | 'no_landlord_permission'
  | 'financial_instability'
  | 'previous_animal_negligence'
  | 'incompatible_lifestyle'
  | 'other'

export type HousingType =
  | 'house_open_yard'
  | 'house_closed_yard'
  | 'house_no_yard'
  | 'apartment_no_screens'
  | 'apartment_with_screens'
  | 'apartment'

export interface PaginationMeta {
  total: number
  page: number
  pageSize: number
  hasNextPage: boolean
}

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }
