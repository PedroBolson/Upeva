import type { Step } from '@/components/ui/stepper'
import type { RadioOption } from '@/components/ui/radio-group'
import type { Species } from '@/types/common'
import type { AdoptionFormData } from '../types/adoption.types'

export const YES_NO_OPTIONS: RadioOption[] = [
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Não' },
]

const ALL_STEP_TITLES = [
  'Identificação',
  'Preferências',
  'Família',
  'Estilo de vida',
  'Moradia',
  'Histórico',
  'Compromisso',
  'Termos',
]

export function getStepLabels(hasSpecificAnimal: boolean): Step[] {
  const titles = hasSpecificAnimal
    ? ALL_STEP_TITLES.filter((_, index) => index !== 1)
    : ALL_STEP_TITLES

  return titles.map((title, index) => ({ id: index + 1, title }))
}

export function getLogicalStep(step: number, hasSpecificAnimal: boolean): number {
  if (!hasSpecificAnimal) return step
  return step >= 2 ? step + 1 : step
}

export function getStepFields(
  step: number,
  species: Species,
  values: Partial<AdoptionFormData>,
): string[] {
  switch (step) {
    case 1:
      return [
        'fullName',
        'cpf',
        'email',
        'birthDate',
        'phone',
        'cep',
        'address.street',
        'address.number',
        'address.neighborhood',
        'address.city',
        'address.state',
      ]

    case 2:
      return species === 'dog'
        ? ['preferredSex', 'preferredSize']
        : ['preferredSex', 'jointAdoption']

    case 3: {
      const fields = ['adultsCount', 'childrenCount']
      if (values.childrenCount && values.childrenCount > 0)
        fields.push('childrenAges')
      return fields
    }

    case 4: {
      const fields = ['adoptionReason', 'hoursHomePeoplePerDay']
      if (species === 'cat') fields.push('isGift')
      return fields
    }

    case 5: {
      const fields = ['housingType', 'isRented']
      if (values.isRented === true) fields.push('landlordAllowsPets')
      return fields
    }

    case 6: {
      const fields = ['hadPetsBefore', 'hasCurrentPets']
      if (values.hadPetsBefore === true) fields.push('previousPets')
      if (values.hasCurrentPets === true) {
        fields.push('currentPetsCount')
        if (species === 'cat') {
          fields.push('currentPetsVaccinated')
          if (values.currentPetsVaccinated === false)
            fields.push('currentPetsVaccinationReason')
        }
      }
      return fields
    }

    case 7:
      return [
        'canAffordCosts',
        'scratchBehaviorResponse',
        'escapeResponse',
        'cannotKeepResponse',
        'longTermCommitment',
      ]

    case 8:
      return [
        'acceptsReturnPolicy',
        'acceptsCastrationPolicy',
        'acceptsFollowUp',
        'acceptsNoResale',
        'acceptsLiabilityTerms',
        'acceptsResponsibility',
      ]

    default:
      return []
  }
}
