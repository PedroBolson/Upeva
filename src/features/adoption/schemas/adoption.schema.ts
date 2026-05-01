import { z } from 'zod'
import type { Species } from '@/types/common'

const HOUSING_TYPES = [
  'house_open_yard',
  'house_closed_yard',
  'house_no_yard',
  'apartment_no_screens',
  'apartment_with_screens',
  'apartment',
] as const

export function createAdoptionSchema(species: Species, hasSpecificAnimal = false) {
  return z
    .object({
      // Step 1
      fullName: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
      cpf: z
        .string()
        .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido (ex: 000.000.000-00)')
        .refine((cpf) => {
          const digits = cpf.replace(/\D/g, '')
          if (/^(\d)\1{10}$/.test(digits)) return false
          const calc = (len: number) => {
            const sum = digits.slice(0, len).split('').reduce((acc, d, i) => acc + Number(d) * (len + 1 - i), 0)
            const rem = (sum * 10) % 11
            return rem === 10 ? 0 : rem
          }
          return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10])
        }, 'CPF inválido'),
      email: z.string().email('E-mail inválido'),
      birthDate: z.string().min(1, 'Informe a data de nascimento'),
      phone: z
        .string()
        .regex(/^\(\d{2}\)\s\d{5}-\d{4}$/, 'Telefone inválido (ex: (11) 99999-9999)'),
      cep: z.string().regex(/^\d{5}-\d{3}$/, 'CEP inválido (ex: 00000-000)'),
      address: z.object({
        street: z.string().min(1, 'Informe a rua'),
        number: z.string().min(1, 'Informe o número'),
        complement: z.string().optional(),
        neighborhood: z.string().min(1, 'Informe o bairro'),
        city: z.string().min(1, 'Informe a cidade'),
        state: z
          .string()
          .length(2, 'Use a sigla do estado (ex: SP)')
          .transform((v) => v.toUpperCase()),
      }),

      // Step 2
      preferredSex: z.enum(['male', 'female', 'any'] as const).optional(),
      preferredSize: z
        .enum(['small', 'medium', 'large', 'any'] as const)
        .optional(),
      jointAdoption: z.boolean().optional(),

      // Step 3
      adultsCount: z.coerce
        .number({ error: 'Informe o número de adultos' })
        .int()
        .min(1, 'Deve haver ao menos 1 adulto responsável'),
      childrenCount: z.coerce
        .number({ error: 'Informe o número de crianças' })
        .int()
        .min(0),
      childrenAges: z.string().optional(),

      // Step 4
      adoptionReason: z
        .string()
        .min(10, 'Descreva o motivo com pelo menos 10 caracteres'),
      isGift: z.boolean().optional(),
      hoursHomePeoplePerDay: z.coerce
        .number({ error: 'Informe as horas' })
        .int()
        .min(0)
        .max(24, 'Máximo de 24 horas'),

      // Step 5
      housingType: z.enum(HOUSING_TYPES, {
        error: 'Selecione o tipo de moradia',
      }),
      isRented: z.boolean().optional(),
      landlordAllowsPets: z.boolean().optional(),

      // Step 6
      hadPetsBefore: z.boolean().optional(),
      previousPets: z.string().optional(),
      hasCurrentPets: z.boolean().optional(),
      currentPetsCount: z.coerce.number().int().min(1).optional(),
      currentPetsVaccinated: z.boolean().optional(),
      currentPetsVaccinationReason: z.string().optional(),

      // Step 7
      canAffordCosts: z.boolean().optional(),
      scratchBehaviorResponse: z
        .string()
        .min(5, 'Descreva como reagiria'),
      escapeResponse: z
        .string()
        .min(5, 'Descreva como reagiria'),
      cannotKeepResponse: z
        .string()
        .min(5, 'Descreva o que faria'),
      longTermCommitment: z.boolean().optional(),

      // Step 8
      acceptsReturnPolicy: z.boolean().optional(),
      acceptsCastrationPolicy: z.boolean().optional(),
      acceptsFollowUp: z.boolean().optional(),
      acceptsNoResale: z.boolean().optional(),
      acceptsLiabilityTerms: z.boolean().optional(),
      acceptsResponsibility: z.boolean().optional(),
      comments: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const addRequired = (path: string, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] })

      // Step 2: species-specific
      if (!hasSpecificAnimal) {
        if (data.preferredSex === undefined)
          addRequired('preferredSex', 'Selecione uma preferência de sexo')
        if (species === 'dog') {
          if (data.preferredSize === undefined)
            addRequired('preferredSize', 'Selecione uma preferência de porte')
        } else {
          if (data.jointAdoption === undefined)
            addRequired('jointAdoption', 'Informe se é adoção conjunta')
        }
      }

      // Step 3: conditional
      if (data.childrenCount > 0 && !data.childrenAges?.trim())
        addRequired('childrenAges', 'Informe as idades das crianças')

      // Step 4: cats only
      if (species === 'cat' && data.isGift === undefined)
        addRequired('isGift', 'Informe se é um presente')

      // Step 5: conditional
      if (data.isRented === undefined)
        addRequired('isRented', 'Informe se o imóvel é alugado')
      if (data.isRented === true && data.landlordAllowsPets === undefined)
        addRequired(
          'landlordAllowsPets',
          'Informe se o proprietário permite animais',
        )

      // Step 6
      if (data.hadPetsBefore === undefined)
        addRequired('hadPetsBefore', 'Responda sobre animais anteriores')
      if (data.hadPetsBefore === true && !data.previousPets?.trim())
        addRequired('previousPets', 'Descreva os animais que já teve')
      if (data.hasCurrentPets === undefined)
        addRequired('hasCurrentPets', 'Informe se tem animais atualmente')
      if (data.hasCurrentPets === true) {
        if (!data.currentPetsCount)
          addRequired('currentPetsCount', 'Informe quantos animais tem')
        if (species === 'cat' && data.currentPetsVaccinated === undefined)
          addRequired(
            'currentPetsVaccinated',
            'Informe se os animais são vacinados',
          )
        if (
          data.currentPetsVaccinated === false &&
          !data.currentPetsVaccinationReason?.trim()
        )
          addRequired(
            'currentPetsVaccinationReason',
            'Explique por que não são vacinados',
          )
      }

      // Step 7: must confirm
      if (data.canAffordCosts !== true)
        addRequired(
          'canAffordCosts',
          'Confirme que pode arcar com os custos de veterinário e alimentação',
        )
      if (data.longTermCommitment !== true)
        addRequired(
          'longTermCommitment',
          'Confirme o compromisso de cuidar do animal por toda a vida',
        )

      // Step 8: all terms must be accepted
      const terms: Array<[keyof typeof data, string]> = [
        ['acceptsReturnPolicy', 'Aceite a política de devolução'],
        ['acceptsCastrationPolicy', 'Aceite o compromisso de castração'],
        ['acceptsFollowUp', 'Aceite o acompanhamento pós-adoção'],
        ['acceptsNoResale', 'Aceite não repassar o animal'],
        ['acceptsLiabilityTerms', 'Aceite os termos de responsabilidade'],
        ['acceptsResponsibility', 'Confirme sua responsabilidade'],
      ]
      for (const [field, message] of terms) {
        if (data[field] !== true) addRequired(field as string, message)
      }
    })
}

export type AdoptionSchema = ReturnType<typeof createAdoptionSchema>
