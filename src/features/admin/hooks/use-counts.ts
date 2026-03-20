import { useQuery } from '@tanstack/react-query'
import { getCounts } from '../services/metadata.service'

export function useCounts() {
  return useQuery({
    queryKey: ['metadata', 'counts'],
    queryFn: getCounts,
    staleTime: 1000 * 60 * 2,
  })
}
