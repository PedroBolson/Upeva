import { useQuery, useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import {
  getFeaturedAnimalsCache,
  callUpdateFeaturedAnimals,
} from '../services/featured-animals.service'
import type { FeaturedAnimalsCache } from '../types/featured-cache.types'

export function useFeaturedSettings() {
  return useQuery<FeaturedAnimalsCache | null>({
    queryKey: ['admin', 'featured'],
    queryFn: getFeaturedAnimalsCache,
    // 60s: fresh enough for the admin page, avoids a read on every tab-focus
    staleTime: 1000 * 60,
  })
}

export function useUpdateFeaturedAnimals() {
  return useMutation({
    mutationFn: (animalIds: string[]) => callUpdateFeaturedAnimals(animalIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'featured'] })
      // Public featured rail should also reflect the new selection immediately
      queryClient.invalidateQueries({ queryKey: ['animals', 'featured'] })
    },
  })
}
