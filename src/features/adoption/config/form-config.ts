import type { Step } from '@/components/ui/stepper'
import type { RadioOption } from '@/components/ui/radio-group'
import type { Species } from '@/types/common'
import type { AdoptionFormData } from '../types/adoption.types'

export const YES_NO_OPTIONS: RadioOption[] = [
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Não' },
]

export const STEP_LABELS: Step[] = [
  { id: 1, title: 'Identificação' },
  { id: 2, title: 'Preferências' },
  { id: 3, title: 'Família' },
  { id: 4, title: 'Estilo de vida' },
  { id: 5, title: 'Moradia' },
  { id: 6, title: 'Histórico' },
  { id: 7, title: 'Compromisso' },
  { id: 8, title: 'Termos' },
]

export const TOTAL_STEPS = STEP_LABELS.length

export function getStepFields(
  step: number,
  species: Species,
  values: Partial<AdoptionFormData>,
): string[] {
  switch (step) {
    case 1:
      return [
        'fullName',
        'email',
        'birthDate',
        'phone',
        'address.street',
        'address.number',
        'address.city',
        'address.state',
      ]

    case 2:
      return species === 'dog'
        ? ['preferredSex', 'preferredSize']
        : ['jointAdoption']

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
