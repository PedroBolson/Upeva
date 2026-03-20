import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCounts, recalibrateCounts } from '../services/metadata.service'

export function useCounts() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['metadata', 'counts'],
    queryFn: getCounts,
    staleTime: 1000 * 60 * 2,
  })

  // Auto-bootstrap: if the document doesn't exist yet, trigger recalibration once
  useEffect(() => {
    if (query.isSuccess && query.data === null) {
      recalibrateCounts()
        .then((counts) => {
          queryClient.setQueryData(['metadata', 'counts'], counts)
        })
        .catch(() => {
          // silently ignore — counts will just show zeros until manually recalibrated
        })
    }
  }, [query.isSuccess, query.data, queryClient])

  return query
}
