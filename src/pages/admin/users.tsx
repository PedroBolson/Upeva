import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UserPlus, Shield, Eye, Trash2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Button, Card, Input, Select, ResponsiveDataList, ConfirmModal } from '@/components/ui'
import type { Column } from '@/components/ui'
import { AdminListSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useUsers, useCreateUser, useUpdateUserRole, useDeleteUser } from '@/features/users/hooks/use-users'
import { useAuth } from '@/features/auth/hooks/use-auth'
import type { UserProfile, UserRole } from '@/types/common'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  reviewer: 'Analista',
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'reviewer', label: 'Analista' },
]

const createUserSchema = z.object({
  displayName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.email('Digite um email válido'),
  password: z.string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .refine((v) => /[A-Z]/.test(v), 'Senha deve conter ao menos uma letra maiúscula')
    .refine((v) => /[a-z]/.test(v), 'Senha deve conter ao menos uma letra minúscula')
    .refine((v) => /[0-9]/.test(v), 'Senha deve conter ao menos um número'),
  role: z.enum(['admin', 'reviewer']),
})

type CreateUserForm = z.infer<typeof createUserSchema>

export function UsersPage() {
  const { userProfile: currentUser } = useAuth()
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUsers()

  const users = data?.pages.flatMap((p) => p.users) ?? []
  const { mutateAsync: createUser, isPending: creating } = useCreateUser()
  const { mutate: updateRole } = useUpdateUserRole()
  const { mutateAsync: deleteUser, isPending: deleting } = useDeleteUser()

  const [showForm, setShowForm] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'reviewer' },
  })

  async function onSubmit(data: CreateUserForm) {
    setCreateError(null)
    setCreateSuccess(false)
    try {
      await createUser(data)
      setCreateSuccess(true)
      reset()
      setShowForm(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('already-exists')) {
        setCreateError('Este email já está em uso.')
      } else if (msg.includes('permission-denied')) {
        setCreateError('Sem permissão para criar usuários.')
      } else if (msg.includes('invalid-argument')) {
        setCreateError(msg.replace('invalid-argument: ', '').trim() || 'Dados inválidos. Verifique os campos e tente novamente.')
      } else {
        setCreateError('Erro ao criar usuário. Tente novamente.')
      }
    }
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteUser(deleteTarget.uid)
    } finally {
      setDeleteTarget(null)
    }
  }

  const isAdmin = currentUser?.role === 'admin'

  const columns: Column<UserProfile>[] = [
    {
      key: 'displayName',
      header: 'Nome',
      cell: (u) => (
        <div>
          <p className="font-medium text-foreground">{u.displayName}</p>
          <p className="text-xs text-muted-foreground">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Papel',
      cell: (u) => <UserRoleBadge role={u.role} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-52',
      cell: (u) => {
        const isSelf = u.uid === currentUser?.uid
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1">
              <Select
                options={ROLE_OPTIONS}
                value={u.role}
                disabled={isSelf || !isAdmin}
                onChange={(value) => updateRole({ uid: u.uid, role: value as UserRole })}
                className="text-xs py-1"
                aria-label="Alterar papel"
              />
              {isSelf && (
                <p className="text-xs text-muted-foreground mt-0.5">Você mesmo</p>
              )}
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isSelf}
                onClick={() => setDeleteTarget(u)}
                className="h-10 w-10 p-0 text-muted-foreground hover:text-danger hover:bg-danger/10 shrink-0"
                aria-label={`Excluir ${u.displayName}`}
              >
                <Trash2 size={20} />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const headerActions = useMemo(
    () => (
      <Button
        size="sm"
        className="h-9 gap-1.5 whitespace-nowrap px-3"
        onClick={() => {
          setShowForm((v) => !v)
          setCreateSuccess(false)
        }}
      >
        <UserPlus size={16} />
        Novo usuário
      </Button>
    ),
    [],
  )

  const headerConfig = useMemo(
    () => ({ actions: headerActions }),
    [headerActions],
  )

  useAdminPageHeader(headerConfig)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AnimatePresence initial={false}>
        {showForm && (
          <motion.div
            key="create-form"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Card className="border-border/80 p-5">
              <motion.div
                className="flex flex-col gap-4"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } } }}
              >
                <motion.h2
                  className="text-sm font-semibold text-foreground"
                  variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } }}
                >
                  Criar novo usuário
                </motion.h2>
                <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } }}>
                    <Input
                      label="Nome completo"
                      error={errors.displayName?.message}
                      required
                      autoComplete="off"
                      {...register('displayName')}
                    />
                  </motion.div>
                  <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } }}>
                    <Input
                      label="Email"
                      type="email"
                      error={errors.email?.message}
                      required
                      autoComplete="off"
                      {...register('email')}
                    />
                  </motion.div>
                  <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } }}>
                    <Input
                      label="Senha inicial"
                      type="password"
                      error={errors.password?.message}
                      required
                      autoComplete="new-password"
                      {...register('password')}
                    />
                  </motion.div>
                  <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } }}>
                    <Controller
                      name="role"
                      control={control}
                      render={({ field }) => (
                        <Select
                          label="Papel"
                          options={ROLE_OPTIONS}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          required
                          error={errors.role?.message}
                        />
                      )}
                    />
                  </motion.div>
                  {createError && (
                    <motion.p
                      role="alert"
                      className="sm:col-span-2 text-sm text-danger"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {createError}
                    </motion.p>
                  )}
                  <motion.div
                    className="sm:col-span-2 flex flex-col gap-3 sm:flex-row"
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } }}
                  >
                    <Button type="submit" loading={creating} className="w-full sm:w-auto">
                      Criar usuário
                    </Button>
                    <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowForm(false)}>
                      Cancelar
                    </Button>
                  </motion.div>
                </form>
              </motion.div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {createSuccess && (
        <p className="text-sm text-success">Usuário criado com sucesso.</p>
      )}

      {isLoading && <AdminListSkeleton rows={8} columns={3} />}

      {error && (
        <ErrorState description="Não foi possível carregar os usuários." onRetry={refetch} />
      )}

      {!isLoading && !error && (
        <>
          <Card className="border-border/80 p-5">
            <div className="mb-4 flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
              </p>
            </div>

            <ResponsiveDataList
              columns={columns}
              data={users}
              keyExtractor={(u) => u.uid}
              renderMobileCard={(user) => (
                <UserMobileCard
                  user={user}
                  isSelf={user.uid === currentUser?.uid}
                  isAdmin={isAdmin}
                  onRoleChange={(role) => updateRole({ uid: user.uid, role })}
                  onDelete={() => setDeleteTarget(user)}
                />
              )}
              emptyMessage="Nenhum usuário encontrado."
            />
          </Card>

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                className="min-w-40"
                loading={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onConfirmDelete}
        title="Excluir usuário"
        description={`Tem certeza que deseja excluir "${deleteTarget?.displayName}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </div>
  )
}

function UserRoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${role === 'admin'
        ? 'bg-primary/10 text-primary'
        : 'bg-muted text-muted-foreground'
        }`}
    >
      {role === 'admin' ? <Shield size={10} /> : <Eye size={10} />}
      {ROLE_LABELS[role]}
    </span>
  )
}

function UserMobileCard({
  user,
  isSelf,
  isAdmin,
  onRoleChange,
  onDelete,
}: {
  user: UserProfile
  isSelf: boolean
  isAdmin: boolean
  onRoleChange: (role: UserRole) => void
  onDelete: () => void
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{user.displayName}</p>
          <p className="mt-1 wrap-break-words text-sm text-muted-foreground">{user.email}</p>
        </div>

        <UserRoleBadge role={user.role} />
      </div>

      <div className="mt-4 rounded-xl bg-muted/35 p-3 flex items-center gap-2">
        <div className="flex-1">
          <Select
            options={ROLE_OPTIONS}
            value={user.role}
            disabled={isSelf || !isAdmin}
            onChange={(value) => onRoleChange(value as UserRole)}
            className="h-11 rounded-xl text-sm"
            aria-label={`Alterar papel de ${user.displayName}`}
          />
          {isSelf && (
            <p className="mt-2 text-xs text-muted-foreground">Você mesmo</p>
          )}
        </div>
        {isAdmin && !isSelf && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-11 w-11 p-0 text-muted-foreground hover:text-danger hover:bg-danger/10 shrink-0 rounded-xl"
            aria-label={`Excluir ${user.displayName}`}
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>
    </Card>
  )
}
