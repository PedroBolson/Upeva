import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { getUsersPaginated, createUser, updateUserRole } from '../services/users.service'
import type { UsersPage, CreateUserPayload } from '../services/users.service'
import type { DocumentSnapshot } from 'firebase/firestore'
import type { UserRole } from '@/types/common'

export function useUsers() {
  return useInfiniteQuery<
    UsersPage,
    Error,
    InfiniteData<UsersPage>,
    string[],
    DocumentSnapshot | null
  >({
    queryKey: ['users'],
    queryFn: ({ pageParam }) => getUsersPaginated(pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
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
