import { z } from 'zod'

export const animalSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  species: z.enum(['dog', 'cat'] as const, { error: 'Selecione a espécie' }),
  sex: z.enum(['male', 'female'] as const, { error: 'Selecione o sexo' }),
  size: z.enum(['small', 'medium', 'large'] as const).optional(),
  breed: z.string().optional(),
  estimatedAge: z.string().optional(),
  description: z.string().min(10, 'Descrição deve ter ao menos 10 caracteres'),
  neutered: z.boolean().default(false),
  specialNeeds: z.string().optional(),
  status: z.enum(['available', 'under_review', 'adopted', 'archived'] as const),
  vaccinesText: z.string().optional(), // newline-separated, converted to array on submit
})

export type AnimalFormData = z.infer<typeof animalSchema>
