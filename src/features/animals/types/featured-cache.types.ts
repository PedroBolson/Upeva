import type { Animal } from './animal.types'

export interface FeaturedAnimalsCache {
  animalIds: string[]
  items: Animal[]
  updatedAt: Date | null
}
