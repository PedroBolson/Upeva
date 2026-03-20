import { useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import type { ApplicationStatus } from '@/types/common'
import { updateApplicationStatus } from '../services/adoption.service'

export function useUpdateApplicationStatus() {
  return useMutation({
    mutationFn: ({
      id,
      status,
      adminNotes,
    }: {
      id: string
      status: ApplicationStatus
      adminNotes?: string
    }) => updateApplicationStatus(id, status, adminNotes),
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
