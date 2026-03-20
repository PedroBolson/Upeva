import { useQuery } from '@tanstack/react-query'
import { getAdminAnimals } from '../services/animals.service'

export function useAdminAnimals() {
  return useQuery({
    queryKey: ['admin', 'animals'],
    queryFn: getAdminAnimals,
  })
}
