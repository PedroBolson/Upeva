import { useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import {
  updateApplicationReview,
  type UpdateApplicationReviewInput,
} from '../services/adoption.service'

export function useUpdateApplicationReview() {
  return useMutation({
    mutationFn: (input: UpdateApplicationReviewInput) => updateApplicationReview(input),
    onSuccess: (_, { id }) => {
      // Invalidate all application list variants (any status filter)
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['applications', 'recent'] })
      queryClient.invalidateQueries({ queryKey: ['applications', 'detail', id] })
      // Counts will update via Cloud Function trigger; invalidate after short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['metadata', 'counts'] })
      }, 2000)
    },
  })
}
