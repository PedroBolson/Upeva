import type { AdoptionApplication } from '../types/adoption.types'

export function normalizeApplicationAnimalIds(
  application: Pick<AdoptionApplication, 'animalId' | 'animalIds'>,
): string[] {
  const ids = Array.isArray(application.animalIds)
    ? application.animalIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []

  if (ids.length > 0) return Array.from(new Set(ids.map((id) => id.trim())))

  return application.animalId?.trim() ? [application.animalId.trim()] : []
}

export function normalizeApplicationAnimalNames(
  application: Pick<AdoptionApplication, 'animalName' | 'animalNames'>,
): string[] {
  const names = Array.isArray(application.animalNames)
    ? application.animalNames.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    : []

  if (names.length > 0) return names.map((name) => name.trim())

  return application.animalName?.trim() ? [application.animalName.trim()] : []
}

export function getApplicationAnimalDisplayNames(
  application: Pick<AdoptionApplication, 'animalId' | 'animalIds' | 'animalName' | 'animalNames'>,
): string[] {
  const ids = normalizeApplicationAnimalIds(application)
  const names = normalizeApplicationAnimalNames(application)

  if (ids.length === 0) return names

  return ids.map((id, index) => names[index] ?? id)
}

export function getApplicationAnimalLabel(application: AdoptionApplication): string {
  const names = getApplicationAnimalDisplayNames(application)
  if (names.length === 0) return 'Interesse geral'
  return names.join(' + ')
}

export function hasApplicationAnimals(application: AdoptionApplication): boolean {
  return normalizeApplicationAnimalIds(application).length > 0
}
