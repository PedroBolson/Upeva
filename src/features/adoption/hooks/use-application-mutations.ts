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
      queryClient.invalidateQueries({ queryKey: ['applications', 'detail', id] })
      // List and counts delayed to let Firestore triggers (queue recalibration,
      // counts sync) finish before the frontend refetches
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['applications'] })
        queryClient.invalidateQueries({ queryKey: ['applications', 'recent'] })
        queryClient.invalidateQueries({ queryKey: ['metadata', 'counts'] })
      }, 2500)
    },
  })
}
