import { useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import type { AnimalStatus } from '@/types/common'
import {
  createAnimal,
  deleteAnimal,
  updateAnimal,
  updateAnimalStatus,
  type AnimalPayload,
} from '../services/animals.service'

function invalidate() {
  queryClient.invalidateQueries({ queryKey: ['animals'] })
  queryClient.invalidateQueries({ queryKey: ['admin', 'animals'] })
  // Cloud Function updates metadata/counts asynchronously — refresh after delay
  setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: ['metadata', 'counts'] })
  }, 2000)
}

export function useCreateAnimal() {
  return useMutation({
    mutationFn: (data: AnimalPayload) => createAnimal(data),
    onSuccess: invalidate,
  })
}

export function useUpdateAnimal() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AnimalPayload> }) =>
      updateAnimal(id, data),
    onSuccess: invalidate,
  })
}

export function useUpdateAnimalStatus() {
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AnimalStatus }) =>
      updateAnimalStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useDeleteAnimal() {
  return useMutation({
    mutationFn: ({ id, photoUrls }: { id: string; photoUrls?: string[] }) =>
      deleteAnimal(id, photoUrls),
    onSuccess: invalidate,
  })
}
