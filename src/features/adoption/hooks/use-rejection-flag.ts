import { useMutation, useQuery } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { checkRejectionFlag, deleteRejectionFlag } from '../services/adoption.service'

export function useRejectionFlag(applicationId: string | undefined) {
  return useQuery({
    queryKey: ['rejection-flags', 'check', applicationId],
    queryFn: () => checkRejectionFlag(applicationId!),
    enabled: !!applicationId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useDeleteRejectionFlag() {
  return useMutation({
    mutationFn: (flagId: string) => deleteRejectionFlag(flagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rejection-flags'] })
    },
  })
}
