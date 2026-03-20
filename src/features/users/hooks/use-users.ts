import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateUserRole } from '../services/users.service'
import type { CreateUserPayload } from '../services/users.service'
import type { UserRole } from '@/types/common'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: UserRole }) =>
      updateUserRole(uid, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}
