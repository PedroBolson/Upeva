import { useMemo, useState } from 'react'
import { UserPlus, Shield, Eye } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Button, Card, Input, Select, ResponsiveDataList } from '@/components/ui'
import type { Column } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useUsers, useCreateUser, useUpdateUserRole } from '@/features/users/hooks/use-users'
import { useAuth } from '@/features/auth/hooks/use-auth'
import type { UserProfile, UserRole } from '@/types/common'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'reviewer', label: 'Reviewer' },
]

const createUserSchema = z.object({
  displayName: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: z.enum(['admin', 'reviewer']),
})

type CreateUserForm = z.infer<typeof createUserSchema>

export function UsersPage() {
  const { userProfile: currentUser } = useAuth()
  const { data: users = [], isLoading, error, refetch } = useUsers()
  const { mutateAsync: createUser, isPending: creating } = useCreateUser()
  const { mutate: updateRole } = useUpdateUserRole()

  const [showForm, setShowForm] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)

  const {
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
      const msg = err instanceof Error ? err.message : 'Erro ao criar usuário.'
      setCreateError(msg.includes('already-exists') ? 'Este email já está em uso.' : msg)
    }
  }

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
      className: 'w-44',
      cell: (u) => {
        const isSelf = u.uid === currentUser?.uid
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              options={ROLE_OPTIONS}
              value={u.role}
              disabled={isSelf}
              onChange={(e) => updateRole({ uid: u.uid, role: e.target.value as UserRole })}
              className="text-xs py-1"
              aria-label="Alterar papel"
            />
            {isSelf && (
              <p className="text-xs text-muted-foreground mt-0.5">Você mesmo</p>
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
    () => ({
      actions: headerActions,
    }),
    [headerActions],
  )

  useAdminPageHeader(headerConfig)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
      </p>

      {/* Create user form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">Criar novo usuário</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome completo"
              error={errors.displayName?.message}
              required
              {...register('displayName')}
            />
            <Input
              label="Email"
              type="email"
              error={errors.email?.message}
              required
              {...register('email')}
            />
            <Input
              label="Senha inicial"
              type="password"
              error={errors.password?.message}
              required
              {...register('password')}
            />
            <Select
              label="Papel"
              options={ROLE_OPTIONS}
              required
              {...register('role')}
            />
            {createError && (
              <p className="sm:col-span-2 text-sm text-danger">{createError}</p>
            )}
            <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" loading={creating} className="w-full sm:w-auto">
                Criar usuário
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {createSuccess && (
        <p className="text-sm text-success">Usuário criado com sucesso.</p>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {error && (
        <ErrorState description="Não foi possível carregar os usuários." onRetry={refetch} />
      )}

      {!isLoading && !error && (
        <ResponsiveDataList
          columns={columns}
          data={users}
          keyExtractor={(u) => u.uid}
          renderMobileCard={(user) => (
            <UserMobileCard
              user={user}
              isSelf={user.uid === currentUser?.uid}
              onRoleChange={(role) => updateRole({ uid: user.uid, role })}
            />
          )}
          emptyMessage="Nenhum usuário encontrado."
        />
      )}
    </div>
  )
}

function UserRoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        role === 'admin'
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
  onRoleChange,
}: {
  user: UserProfile
  isSelf: boolean
  onRoleChange: (role: UserRole) => void
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{user.displayName}</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">{user.email}</p>
        </div>

        <UserRoleBadge role={user.role} />
      </div>

      <div className="mt-4 rounded-xl bg-muted/35 p-3">
        <Select
          options={ROLE_OPTIONS}
          value={user.role}
          disabled={isSelf}
          onChange={(e) => onRoleChange(e.target.value as UserRole)}
          className="h-11 rounded-xl text-sm"
          aria-label={`Alterar papel de ${user.displayName}`}
        />
        {isSelf && (
          <p className="mt-2 text-xs text-muted-foreground">Você mesmo</p>
        )}
      </div>
    </Card>
  )
}
