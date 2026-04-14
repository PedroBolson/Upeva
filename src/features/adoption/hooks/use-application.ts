import { useQuery } from '@tanstack/react-query'
import { getApplicationById } from '../services/adoption.service'

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: ['applications', 'detail', id],
    queryFn: () => getApplicationById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}
