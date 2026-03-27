import type { Timestamp, Species, HousingType, ApplicationStatus } from '@/types/common'

export interface AdoptionFormData {
  // Step 1: Identificação
  fullName: string
  cpf: string
  email: string
  birthDate: string
  phone: string
  cep: string
  address: {
    street: string
    number: string
    complement?: string
    city: string
    state: string
  }

  // Step 2: Preferências (species-specific)
  preferredSex?: 'male' | 'female' | 'any'        // dogs only
  preferredSize?: 'small' | 'medium' | 'large' | 'any'  // dogs only
  jointAdoption?: boolean                           // cats only

  // Step 3: Família
  adultsCount: number
  childrenCount: number
  childrenAges?: string                             // required when childrenCount > 0

  // Step 4: Estilo de vida
  adoptionReason: string
  isGift?: boolean                                  // cats only
  hoursHomePeoplePerDay: number

  // Step 5: Moradia
  housingType: HousingType
  isRented?: boolean
  landlordAllowsPets?: boolean                      // required when isRented

  // Step 6: Histórico com animais
  hadPetsBefore?: boolean
  previousPets?: string                             // required when hadPetsBefore
  hasCurrentPets?: boolean
  currentPetsCount?: number                         // required when hasCurrentPets
  currentPetsVaccinated?: boolean                   // cats only, required when hasCurrentPets
  currentPetsVaccinationReason?: string             // required when !currentPetsVaccinated

  // Step 7: Compromisso
  canAffordCosts?: boolean                          // must be true
  scratchBehaviorResponse: string
  escapeResponse: string
  cannotKeepResponse: string
  longTermCommitment?: boolean                      // must be true

  // Step 8: Termos
  acceptsReturnPolicy?: boolean
  acceptsCastrationPolicy?: boolean
  acceptsFollowUp?: boolean
  acceptsNoResale?: boolean
  acceptsLiabilityTerms?: boolean
  acceptsResponsibility?: boolean
  comments?: string
}

export interface AdoptionApplication extends AdoptionFormData {
  id: string
  animalId?: string
  animalName?: string
  species: Species
  status: ApplicationStatus
  adminNotes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type CreateApplicationPayload = Omit<
  AdoptionApplication,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>
