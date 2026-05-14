import { useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { invalidateArchiveFileQueries } from '@/features/admin/hooks/use-archive-files'
import {
  updateApplicationReview,
  type UpdateApplicationReviewInput,
} from '../services/adoption.service'
import { normalizeApplicationAnimalIds } from '../utils/application-animals'
import type { AdoptionApplication } from '../types/adoption.types'
import type { ApplicationStatus } from '@/types/common'

type ReviewMutationContext = {
  previousStatus?: ApplicationStatus
  previousAnimalIds: string[]
}

function requestedAnimalIds(input: UpdateApplicationReviewInput): string[] {
  if (Array.isArray(input.animalIds) && input.animalIds.length > 0) {
    return Array.from(
      new Set(input.animalIds.map((id) => id.trim()).filter(Boolean)),
    )
  }

  return input.animalId?.trim() ? [input.animalId.trim()] : []
}

function shouldInvalidateAnimalQueries(
  input: UpdateApplicationReviewInput,
  context: ReviewMutationContext | undefined,
) {
  const previousStatus = context?.previousStatus

  return (
    requestedAnimalIds(input).length > 0 ||
    input.status === 'approved' ||
    previousStatus === 'approved' ||
    (
      previousStatus !== undefined &&
      previousStatus !== input.status &&
      (context?.previousAnimalIds.length ?? 0) > 0
    )
  )
}

function shouldInvalidateArchiveQueries(
  input: UpdateApplicationReviewInput,
  context: ReviewMutationContext | undefined,
) {
  return input.status === 'approved' || context?.previousStatus === 'approved'
}

export function useUpdateApplicationReview() {
  return useMutation({
    mutationFn: (input: UpdateApplicationReviewInput) => updateApplicationReview(input),
    onMutate: ({ id }) => {
      const previousApplication = queryClient.getQueryData<AdoptionApplication | null>([
        'applications',
        'detail',
        id,
      ])

      return {
        previousStatus: previousApplication?.status,
        previousAnimalIds: previousApplication
          ? normalizeApplicationAnimalIds(previousApplication)
          : [],
      } satisfies ReviewMutationContext
    },
    onSuccess: (_, input, context) => {
      const { id } = input
      queryClient.invalidateQueries({ queryKey: ['applications', 'detail', id] })

      if (shouldInvalidateArchiveQueries(input, context)) {
        invalidateArchiveFileQueries({ delayedFilterOptions: true })
      }

      if (shouldInvalidateAnimalQueries(input, context)) {
        queryClient.invalidateQueries({ queryKey: ['animals'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'animals'] })
      }

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['applications'] })
        queryClient.invalidateQueries({ queryKey: ['applications', 'recent'] })
        queryClient.invalidateQueries({ queryKey: ['metadata', 'counts'] })
      }, 2500)
    },
  })
}
