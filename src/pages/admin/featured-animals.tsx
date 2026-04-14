import { useMemo, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Reorder } from 'framer-motion'
import { GripVertical, Plus, Star, Trash2, ImageOff, Check, Search } from 'lucide-react'
import { Button, Input, Badge, Modal, EmptyState, Spinner } from '@/components/ui'
import { AdminListSkeleton } from '@/components/ui/skeleton'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useAdminAnimals } from '@/features/animals/hooks/use-admin-animals'
import { useFeaturedSettings, useUpdateFeaturedAnimals } from '@/features/animals/hooks/use-featured-settings'
import { SPECIES_LABELS, SEX_LABELS } from '@/features/animals/types/animal.types'
import type { Animal } from '@/features/animals/types/animal.types'
import type { FeaturedAnimalsCache } from '@/features/animals/types/featured-cache.types'
import { buildAdminTitle, useDocumentTitle } from '@/utils/page-title'
import { cn } from '@/utils/cn'

const MAX_FEATURED = 12

// ── Draggable row ─────────────────────────────────────────────────────────────

interface FeaturedRowProps {
  animal: Animal
  onRemove: (id: string) => void
}

function FeaturedRow({ animal, onRemove }: FeaturedRowProps) {
  const coverPhoto = animal.photos[animal.coverPhotoIndex] ?? animal.photos[0]
  const meta = [SPECIES_LABELS[animal.species], SEX_LABELS[animal.sex]]

  return (
    <Reorder.Item
      value={animal}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5',
        'shadow-sm select-none cursor-grab active:cursor-grabbing',
      )}
    >
      <GripVertical size={16} className="text-muted-foreground shrink-0" />

      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {coverPhoto ? (
          <img src={coverPhoto} alt={animal.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageOff size={14} className="text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{animal.name}</p>

      <div className="flex items-center gap-1.5 shrink-0">
        {meta.map((label) => (
          <Badge key={label} variant="accent" className="text-xs font-normal">{label}</Badge>
        ))}
      </div>

      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(animal.id)}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
        aria-label={`Remover ${animal.name} dos destaques`}
      >
        <Trash2 size={14} />
      </button>
    </Reorder.Item>
  )
}

// ── Animal picker modal ───────────────────────────────────────────────────────

interface AnimalPickerModalProps {
  open: boolean
  onClose: () => void
  selectedIds: Set<string>
  onConfirm: (animals: Animal[]) => void
  remaining: number
}

function AnimalPickerModal({ open, onClose, selectedIds, onConfirm, remaining }: AnimalPickerModalProps) {
  const [search, setSearch] = useState('')
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const { animals: allAnimals, hasMore, isLoading, isFetchingMore, fetchMore } = useAdminAnimals(null)

  const pickable = useMemo(
    () => allAnimals.filter((a) => a.status === 'available' || a.status === 'under_review'),
    [allAnimals],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q ? pickable.filter((a) => a.name.toLowerCase().includes(q)) : pickable
  }, [pickable, search])

  function toggleAnimal(animal: Animal) {
    if (selectedIds.has(animal.id)) return
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(animal.id)) next.delete(animal.id)
      else next.add(animal.id)
      return next
    })
  }

  function handleConfirm() {
    const toAdd = allAnimals.filter((a) => pendingIds.has(a.id))
    onConfirm(toAdd)
    setPendingIds(new Set())
    setSearch('')
  }

  function handleClose() {
    setPendingIds(new Set())
    setSearch('')
    onClose()
  }

  const canAddMore = pendingIds.size > 0 && pendingIds.size <= remaining

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Adicionar animais em destaque"
      description={`Selecione até ${remaining} ${remaining !== 1 ? 'animais' : 'animal'} para adicionar ao pool.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canAddMore}>
            {pendingIds.size > 0
              ? `Adicionar ${pendingIds.size} ${pendingIds.size !== 1 ? 'animais' : 'animal'}`
              : 'Adicionar selecionados'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Buscar por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={14} />}
        />

        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum animal encontrado" />
        ) : (
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
            {filtered.map((animal) => {
              const isAlreadySelected = selectedIds.has(animal.id)
              const isPending = pendingIds.has(animal.id)
              const coverPhoto = animal.photos[animal.coverPhotoIndex] ?? animal.photos[0]

              return (
                <button
                  key={animal.id}
                  onClick={() => toggleAnimal(animal)}
                  disabled={isAlreadySelected}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors duration-150',
                    isAlreadySelected
                      ? 'border-border bg-muted opacity-50 cursor-not-allowed'
                      : isPending
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-accent',
                  )}
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                    {coverPhoto ? (
                      <img src={coverPhoto} alt={animal.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageOff size={12} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{animal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {SPECIES_LABELS[animal.species]} · {SEX_LABELS[animal.sex]}
                    </p>
                  </div>

                  <div className="shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors border-border bg-background">
                    {(isPending || isAlreadySelected) && (
                      <Check size={12} className={cn(
                        isPending ? 'text-primary' : 'text-muted-foreground',
                      )} />
                    )}
                  </div>
                </button>
              )
            })}

            {hasMore && (
              <button
                onClick={() => fetchMore()}
                disabled={isFetchingMore}
                className="mt-1 text-center text-xs text-primary hover:underline disabled:opacity-50"
              >
                {isFetchingMore ? 'Carregando…' : 'Ver mais'}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FeaturedAnimalsPage() {
  useDocumentTitle(buildAdminTitle('Destaques'))

  const queryClient = useQueryClient()
  const { data: cached, isLoading } = useFeaturedSettings()
  const { mutate: save, isPending: isSaving, error: saveError } = useUpdateFeaturedAnimals()

  // Tracks user's pending edits. When false, the server state (cached) is displayed.
  // This avoids the need for useEffect to sync local state from async data.
  const [hasEdited, setHasEdited] = useState(false)
  const [localList, setLocalList] = useState<Animal[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const effectiveList = useMemo(
    () => hasEdited ? localList : (cached?.items ?? []),
    [hasEdited, localList, cached],
  )

  const selectedIds = useMemo(() => new Set(effectiveList.map((a) => a.id)), [effectiveList])
  const remaining = MAX_FEATURED - effectiveList.length

  function handleRemove(id: string) {
    setHasEdited(true)
    setLocalList(effectiveList.filter((a) => a.id !== id))
  }

  function handleReorder(newList: Animal[]) {
    setHasEdited(true)
    setLocalList(newList)
  }

  function handlePickerConfirm(animals: Animal[]) {
    setHasEdited(true)
    setLocalList([...effectiveList, ...animals.filter((a) => !selectedIds.has(a.id))])
    setPickerOpen(false)
  }

  const handleSave = useCallback(() => {
    save(effectiveList.map((a) => a.id), {
      onSuccess: () => {
        // Patch the cache before switching back to it so the list doesn't
        // flicker through stale data while the background refetch is in-flight.
        queryClient.setQueryData<FeaturedAnimalsCache | null>(
          ['admin', 'featured'],
          (old) => old
            ? { ...old, animalIds: effectiveList.map((a) => a.id), items: effectiveList }
            : old,
        )
        setHasEdited(false)
      },
    })
  }, [effectiveList, save, queryClient])

  useAdminPageHeader(useMemo(() => ({
    title: 'Animais em Destaque',
    subtitle: 'Defina quais animais aparecem na página inicial. O sistema sorteia 4 por sessão.',
    actions: (
      <div className="flex items-center gap-3">
        <Badge variant="accent">
          {effectiveList.length} / {MAX_FEATURED}
        </Badge>
        {remaining > 0 && (
          <Button variant="outline" onClick={() => setPickerOpen(true)} className="gap-2">
            <Plus size={16} />
            Adicionar animal
          </Button>
        )}
        <Button onClick={handleSave} disabled={!hasEdited || isSaving || isLoading}>
          {isSaving ? <><Spinner size="sm" /><span className="ml-2">Salvando…</span></> : 'Salvar destaques'}
        </Button>
      </div>
    ),
  }), [effectiveList.length, remaining, handleSave, hasEdited, isSaving, isLoading]))

  if (isLoading) return <AdminListSkeleton columns={1} />

  return (
    <div className="flex flex-col gap-6">
      {saveError && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {saveError instanceof Error ? saveError.message : 'Não foi possível salvar os destaques. Tente novamente.'}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Reorder.Group
          axis="y"
          values={effectiveList}
          onReorder={handleReorder}
          className="flex flex-col gap-2"
        >
          {effectiveList.map((animal) => (
            <FeaturedRow key={animal.id} animal={animal} onRemove={handleRemove} />
          ))}
        </Reorder.Group>

        {effectiveList.length === 0 && (
          <>
            <EmptyState
              title="Nenhum animal em destaque"
              description="Adicione animais para que apareçam na página inicial."
              icon={Star}
            />
            {hasEdited && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-center text-sm text-warning-foreground">
                Ao salvar sem destaques, a página inicial exibirá animais aleatórios.
              </p>
            )}
          </>
        )}
      </div>

      <AnimalPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedIds={selectedIds}
        onConfirm={handlePickerConfirm}
        remaining={remaining}
      />
    </div>
  )
}
