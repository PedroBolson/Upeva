import type { Animal } from '../types/animal.types'
import { SEX_LABELS, SIZE_LABELS } from '../types/animal.types'

export function getAnimalPublicUrl(animalId: string): string {
  return `${window.location.origin}/animais/${animalId}`
}

export function buildAnimalSocialPost(animal: Animal, publicUrl?: string): string {
  const parts: string[] = []

  const article = animal.sex === 'female' ? 'a' : 'o'
  parts.push(`🐾 Conheça ${article} ${animal.name}!`)

  if (animal.description?.trim()) {
    parts.push('')
    parts.push(animal.description.trim())
  }

  const traits: string[] = []

  if (animal.sex) {
    traits.push(SEX_LABELS[animal.sex])
  }

  if (animal.estimatedAge?.trim()) {
    traits.push(animal.estimatedAge.trim())
  }

  if (animal.breed?.trim() && animal.breed !== 'Sem raça definida') {
    traits.push(animal.breed.trim())
  }

  if (animal.species === 'dog' && animal.size) {
    traits.push(`Porte ${SIZE_LABELS[animal.size].toLowerCase()}`)
  }

  if (animal.neutered) {
    traits.push(animal.sex === 'female' ? 'Castrada' : 'Castrado')
  }

  const cleanVaccines = animal.vaccines.filter((v) => v.trim())
  if (cleanVaccines.length > 0) {
    const suffix = animal.sex === 'female' ? 'a' : 'o'
    const vacinaLabel =
      cleanVaccines.length === 1
        ? `Vacinad${suffix}: ${cleanVaccines[0]}`
        : `Vacinad${suffix} (${cleanVaccines.length} vacinas)`
    traits.push(vacinaLabel)
  }

  if (animal.specialNeeds?.trim()) {
    traits.push(`Necessidades especiais: ${animal.specialNeeds.trim()}`)
  }

  if (traits.length > 0) {
    parts.push('')
    for (const trait of traits) {
      parts.push(`✨ ${trait}`)
    }
  }

  parts.push('')
  if (publicUrl) {
    parts.push(
      `Para conhecer melhor e saber como adotar, acesse:\n${publicUrl}`,
    )
  } else {
    const contraction = animal.sex === 'female' ? 'pela' : 'pelo'
    parts.push(
      `Se você se apaixonou ${contraction} ${animal.name}, entre em contato com a Upeva e saiba mais sobre o processo de adoção responsável. 💛`,
    )
  }

  parts.push('')
  parts.push('#AdoçãoResponsável #AdoteNãoCompre #Upeva')

  return parts.join('\n')
}
