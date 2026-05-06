import { z } from 'zod'

export const animalSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  species: z.enum(['dog', 'cat'] as const, { error: 'Selecione a espécie' }),
  sex: z.enum(['male', 'female'] as const, { error: 'Selecione o sexo' }),
  size: z.enum(['small', 'medium', 'large'] as const).optional(),
  isSrd: z.boolean().default(false),
  breed: z.string().min(1, 'Raça obrigatória').max(100, 'Máximo 100 caracteres'),
  coatColor: z.string().min(1, 'Pelagem e cor obrigatória').max(100, 'Máximo 100 caracteres'),
  estimatedAge: z.string().optional(),
  description: z.string().min(10, 'Descrição deve ter ao menos 10 caracteres'),
  neutered: z.boolean().default(false),
  specialNeeds: z.string().optional(),
  status: z.enum(['available', 'under_review', 'adopted', 'archived'] as const),
})

export type AnimalFormData = z.infer<typeof animalSchema>
