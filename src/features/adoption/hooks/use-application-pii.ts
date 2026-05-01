import { useQuery } from '@tanstack/react-query'
import { getApplicationPII } from '../services/adoption.service'

export function useApplicationPII(id: string | undefined) {
  return useQuery({
    queryKey: ['applications', 'pii', id],
    queryFn: () => getApplicationPII(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}
