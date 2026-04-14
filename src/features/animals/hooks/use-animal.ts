import { useQuery } from '@tanstack/react-query'
import { getAnimalById } from '../services/animals.service'

export function useAnimal(id: string | undefined) {
  return useQuery({
    queryKey: ['animals', 'detail', id],
    queryFn: () => getAnimalById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}
