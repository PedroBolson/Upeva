import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, PawPrint, Search } from 'lucide-react'
import { Button, Input, AnimalStatusBadge, DataTable } from '@/components/ui'
import type { Column } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { Select } from '@/components/ui/select'
import { useAdminAnimals } from '@/features/animals/hooks/use-admin-animals'
import { useUpdateAnimalStatus } from '@/features/animals/hooks/use-animal-mutations'
import { SPECIES_LABELS, SEX_LABELS, SIZE_LABELS } from '@/features/animals/types/animal.types'
import type { Animal } from '@/features/animals/types/animal.types'
import type { AnimalStatus } from '@/types/common'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'available', label: 'Disponível' },
  { value: 'under_review', label: 'Em análise' },
  { value: 'adopted', label: 'Adotado' },
  { value: 'archived', label: 'Arquivado' },
]

export function AdminAnimalsPage() {
  const navigate = useNavigate()
  const { data: animals = [], isLoading, error, refetch } = useAdminAnimals()
  const { mutate: updateStatus } = useUpdateAnimalStatus()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AnimalStatus | ''>('')



  const filtered = animals.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const columns: Column<Animal>[] = [
    {
      key: 'photo',
      header: '',
      className: 'w-12',
      cell: (a) => (
        <div className="h-9 w-9 rounded-md overflow-hidden bg-muted">
          {a.photos[a.coverPhotoIndex] ? (
            <img src={a.photos[a.coverPhotoIndex]} alt={a.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <PawPrint size={14} className="text-muted-foreground" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Nome',
      cell: (a) => (
        <span className="font-medium text-foreground">{a.name}</span>
      ),
    },
    {
      key: 'species',
      header: 'Espécie',
      cell: (a) => <span className="text-muted-foreground">{SPECIES_LABELS[a.species]}</span>,
    },
    {
      key: 'sex',
      header: 'Sexo',
      cell: (a) => <span className="text-muted-foreground">{SEX_LABELS[a.sex]}</span>,
    },
    {
      key: 'size',
      header: 'Porte',
      cell: (a) =>
        a.size ? (
          <span className="text-muted-foreground">{SIZE_LABELS[a.size]}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => <AnimalStatusBadge status={a.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-40',
      cell: (a) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Select
            options={[
              { value: 'available', label: 'Disponível' },
              { value: 'under_review', label: 'Em análise' },
              { value: 'adopted', label: 'Adotado' },
              { value: 'archived', label: 'Arquivar' },
            ]}
            value={a.status}
            onChange={(e) =>
              updateStatus({ id: a.id, status: e.target.value as AnimalStatus })
            }
            className="text-xs py-1"
            aria-label="Alterar status"
          />
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Animais</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} animal{filtered.length !== 1 ? 'is' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/admin/animais/novo">
          <Button className="gap-1.5">
            <Plus size={16} />
            Cadastrar animal
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
        </div>
        <div className="w-48">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AnimalStatus | '')}
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {error && (
        <ErrorState
          description="Não foi possível carregar os animais."
          onRetry={refetch}
        />
      )}

      {!isLoading && !error && (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(a) => a.id}
          onRowClick={(a) => navigate(`/admin/animais/${a.id}/editar`)}
          emptyMessage="Nenhum animal encontrado com esses filtros."
        />
      )}
    </div>
  )
}
