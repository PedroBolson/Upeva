import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import type { Animal } from '../types/animal.types'
import type { FeaturedAnimalsCache } from '../types/featured-cache.types'

function isPublicSafeAnimal(animal: Animal): boolean {
  return animal.status === 'available' || animal.status === 'under_review'
}

export async function getFeaturedAnimalsCache(): Promise<FeaturedAnimalsCache | null> {
  const snap = await getDoc(doc(db, 'metadata', 'featuredAnimals'))
  if (!snap.exists()) return null

  const data = snap.data()
  const items = ((data.items as Animal[]) ?? []).filter(isPublicSafeAnimal)

  return {
    animalIds: items.map((animal) => animal.id),
    items,
    updatedAt: data.updatedAt?.toDate() ?? null,
  }
}

export async function callUpdateFeaturedAnimals(animalIds: string[]): Promise<void> {
  const fn = httpsCallable<{ animalIds: string[] }, void>(functions, 'updateFeaturedAnimals')
  await fn({ animalIds })
}
