import { useState } from 'react'
import { UserPlus, Shield, Eye } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Button, Input, Select, DataTable } from '@/components/ui'
import type { Column } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
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
      cell: (u) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            u.role === 'admin'
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {u.role === 'admin' ? <Shield size={10} /> : <Eye size={10} />}
          {ROLE_LABELS[u.role]}
        </span>
      ),
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => { setShowForm((v) => !v); setCreateSuccess(false) }}>
          <UserPlus size={16} />
          Novo usuário
        </Button>
      </div>

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
            <div className="sm:col-span-2 flex gap-3">
              <Button type="submit" loading={creating}>
                Criar usuário
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
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
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(u) => u.uid}
          emptyMessage="Nenhum usuário encontrado."
        />
      )}
    </div>
  )
}
