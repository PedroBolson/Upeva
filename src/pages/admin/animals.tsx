import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Button, Card, Input, AnimalStatusBadge, ResponsiveDataList, Select } from '@/components/ui'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { AnimalPhotoThumbnail } from '@/features/animals/components/animal-photo-thumbnail'
import type { Column } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { AdminHeaderOverflow } from '@/features/admin/components/admin-header-overflow'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useHeaderCompaction } from '@/features/admin/hooks/use-header-compaction'
import { useAdminAnimals } from '@/features/animals/hooks/use-admin-animals'
import { useDeleteAnimal, useUpdateAnimalStatus } from '@/features/animals/hooks/use-animal-mutations'
import { SPECIES_LABELS, SEX_LABELS, SIZE_LABELS, STATUS_LABELS } from '@/features/animals/types/animal.types'
import { ANIMAL_STATUS_OPTIONS } from '@/features/animals/config/animal-status-options'
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
  const [statusFilter, setStatusFilter] = useState<AnimalStatus | ''>('')
  const [search, setSearch] = useState('')
  const [animalToDelete, setAnimalToDelete] = useState<Animal | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { containerRef, measureRef, isCompact } = useHeaderCompaction()

  const { animals: allAnimals, hasMore, isLoading, isFetchingMore, error, fetchMore, refetch } =
    useAdminAnimals(statusFilter || null)

  const { mutate: updateStatus } = useUpdateAnimalStatus()
  const { mutate: deleteAnimal, isPending: isDeletingAnimal } = useDeleteAnimal()

  // Client-side name search on the current (server-filtered) set
  const filtered = useMemo(
    () =>
      search
        ? allAnimals.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
        : allAnimals,
    [allAnimals, search],
  )
  const activeStatusLabel = statusFilter ? STATUS_LABELS[statusFilter] : 'Todos os status'
  const searchTerm = search.trim()

  function handleConfirmDelete() {
    if (!animalToDelete) return

    setDeleteError(null)
    deleteAnimal(
      { id: animalToDelete.id, photoUrls: animalToDelete.photos },
      {
        onSuccess: () => {
          setAnimalToDelete(null)
        },
        onError: (err) => {
          const message = err instanceof Error && err.message.includes('linked-applications')
            ? 'Este animal possui candidaturas vinculadas e não pode ser excluído.'
            : 'Não foi possível excluir o animal. Tente novamente.'
          setDeleteError(message)
          setAnimalToDelete(null)
        },
      },
    )
  }

  const headerActions = useMemo(
    () => (
      <div ref={containerRef} className="relative flex min-w-0 items-center gap-2">
        <div
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 inline-flex items-center gap-2 whitespace-nowrap"
        >
          <div className="w-30 shrink-0">
            <Input
              placeholder="Buscar por nome…"
              value={search}
              onChange={() => undefined}
              leftIcon={<Search size={14} />}
              className="h-9 rounded-lg"
            />
          </div>
          <div className="w-40 shrink-0">
            <Select
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={() => undefined}
              className="h-9 rounded-lg"
            />
          </div>
          <Button size="sm" className="h-9 gap-1.5 whitespace-nowrap px-3">
            <Plus size={16} />
            <span>Cadastrar animal</span>
          </Button>
        </div>

        <div className="min-w-30 flex-1 max-w-[18rem]">
          <Input
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
            className="h-9 rounded-lg"
          />
        </div>

        {!isCompact && (
          <>
            <div className="w-40 shrink-0">
              <Select
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as AnimalStatus | '')}
                className="h-9 rounded-lg"
              />
            </div>

            <Link to="/admin/animais/novo" className="shrink-0">
              <Button size="sm" className="h-9 gap-1.5 whitespace-nowrap px-3">
                <Plus size={16} />
                <span className="hidden min-[480px]:inline">Cadastrar animal</span>
                <span className="min-[480px]:hidden">Novo</span>
              </Button>
            </Link>
          </>
        )}

        {isCompact && (
          <AdminHeaderOverflow
            label={statusFilter ? 'Status' : 'Filtros'}
            active={Boolean(statusFilter)}
          >
            <Select
              label="Status"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as AnimalStatus | '')}
              className="h-10 rounded-lg"
            />
          </AdminHeaderOverflow>
        )}
      </div>
    ),
    [containerRef, isCompact, measureRef, search, statusFilter],
  )

  useAdminPageHeader(useMemo(() => ({ actions: headerActions }), [headerActions]))

  const columns: Column<Animal>[] = [
    {
      key: 'animal',
      header: 'Animal',
      className: 'min-w-[16rem]',
      cell: (a) => (
        <div className="flex items-center gap-3">
          <AnimalPhotoThumbnail src={a.photos[a.coverPhotoIndex]} alt={a.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{a.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {a.breed || 'Raça não informada'}
              {a.estimatedAge ? ` · ${a.estimatedAge}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'profile',
      header: 'Perfil',
      className: 'min-w-[11rem]',
      cell: (a) => (
        <div>
          <p className="text-sm text-foreground">
            {SPECIES_LABELS[a.species]} · {SEX_LABELS[a.sex]}
          </p>
          <p className="text-xs text-muted-foreground">
            {a.species === 'dog'
              ? a.size
                ? SIZE_LABELS[a.size]
                : 'Porte não informado'
              : ''}
          </p>
        </div>
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
      className: 'w-56',
      cell: (a) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Select
            options={ANIMAL_STATUS_OPTIONS}
            value={a.status}
            onChange={(value) =>
              updateStatus({ id: a.id, status: value as AnimalStatus })
            }
            className="text-xs py-1"
            aria-label="Alterar status"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-danger"
            aria-label={`Excluir ${a.name}`}
            onClick={() => {
              setDeleteError(null)
              setAnimalToDelete(a)
            }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <ConfirmModal
        open={animalToDelete !== null}
        onClose={() => setAnimalToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir animal?"
        description={
          animalToDelete
            ? `Isso removerá ${animalToDelete.name} do sistema e apagará as fotos vinculadas.`
            : undefined
        }
        confirmLabel="Excluir animal"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isDeletingAnimal}
      />

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
        <Card className="border-border/80 p-5">
          <div className="mb-4 flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              {filtered.length} animal{filtered.length !== 1 ? 'is' : ''} carregado{filtered.length !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-muted-foreground">
              Mostrando o status <strong className="text-foreground">{activeStatusLabel}</strong>
              {searchTerm ? (
                <>
                  {' '}para a busca <strong className="text-foreground">"{searchTerm}"</strong>.
                </>
              ) : (
                '.'
              )}
            </p>
            {deleteError && (
              <p role="alert" className="text-sm text-danger">
                {deleteError}
              </p>
            )}
          </div>

          <ResponsiveDataList
            columns={columns}
            data={filtered}
            keyExtractor={(a) => a.id}
            onRowClick={(a) => navigate(`/admin/animais/${a.id}/editar`)}
            renderMobileCard={(animal) => (
              <AnimalMobileCard
                animal={animal}
                onEdit={() => navigate(`/admin/animais/${animal.id}/editar`)}
                onStatusChange={(status) => updateStatus({ id: animal.id, status })}
                onDelete={() => {
                  setDeleteError(null)
                  setAnimalToDelete(animal)
                }}
              />
            )}
            emptyMessage="Nenhum animal encontrado com esses filtros."
          />
        </Card>
      )}

      {/* Load more */}
      {!isLoading && !error && (hasMore || isFetchingMore) && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchMore()}
            disabled={isFetchingMore}
            className="min-w-40"
          >
            {isFetchingMore ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Carregando…
              </span>
            ) : (
              'Carregar mais animais'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

function AnimalMobileCard({
  animal,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  animal: Animal
  onEdit: () => void
  onStatusChange: (status: AnimalStatus) => void
  onDelete: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit()
        }
      }}
      className="cursor-pointer"
    >
      <Card className="border-border/80 p-4">
        <div className="flex items-start gap-3">
          <AnimalPhotoThumbnail
            src={animal.photos[animal.coverPhotoIndex]}
            alt={animal.name}
            size="md"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">
                    {animal.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {SPECIES_LABELS[animal.species]} · {SEX_LABELS[animal.sex]}
                    {animal.species === 'dog' && animal.size ? ` · ${SIZE_LABELS[animal.size]}` : ''}
                  </p>
                  {(animal.breed || animal.estimatedAge) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[animal.breed, animal.estimatedAge].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <AnimalStatusBadge status={animal.status} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Select
              options={ANIMAL_STATUS_OPTIONS}
              value={animal.status}
              onChange={(value) => onStatusChange(value as AnimalStatus)}
              className="h-11 rounded-xl text-sm"
              aria-label={`Alterar status de ${animal.name}`}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            Editar animal
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-danger hover:bg-danger/10 hover:text-danger"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 size={14} />
            Excluir animal
          </Button>
        </div>
      </Card>
    </div>
  )
}
