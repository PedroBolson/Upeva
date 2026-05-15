import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ClipboardList, FileText, Loader2, Plus, Share2, Star, Trash2, X } from 'lucide-react'
import { AnimalStatusBadge, Button, Card, Checkbox, Input, Select, useToast } from '@/components/ui'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Textarea } from '@/components/ui/textarea'
import { FileUpload } from '@/components/ui/file-upload'
import { PageSpinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useAnimal } from '@/features/animals/hooks/use-animal'
import { useArchiveAnimal, useCreateAnimal, useDeleteAnimal, useUpdateAnimal, useUpdateAnimalStatus } from '@/features/animals/hooks/use-animal-mutations'
import { ArchiveAnimalModal } from '@/features/animals/components/archive-animal-modal'
import { SocialPostModal } from '@/features/animals/components/social-post-modal'
import { TraceabilityCard } from '@/features/admin/components/traceability-card'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useRelatedArchiveFiles } from '@/features/admin/hooks/use-archive-files'
import { useAuthContext } from '@/features/auth/contexts/auth.context'
import { formatActorLabel, formatTraceDate } from '@/features/admin/utils/traceability'
import { uploadAnimalPhoto, deleteAnimalPhoto } from '@/features/animals/services/animal-storage.service'
import { animalSchema, type AnimalFormData } from '@/features/animals/schemas/animal.schema'
import { ANIMAL_STATUS_OPTIONS } from '@/features/animals/config/animal-status-options'
import { SEX_LABELS, SIZE_LABELS, SPECIES_LABELS, STATUS_LABELS } from '@/features/animals/types/animal.types'
import type { ArchiveReason } from '@/types/common'
import { cn } from '@/utils/cn'
import { buildAdminTitle, useDocumentTitle } from '@/utils/page-title'
import type { ArchiveFile, ArchiveFileType } from '@/features/admin/services/archive.service'

const SPECIES_OPTIONS = [
  { value: 'dog', label: 'Cachorro' },
  { value: 'cat', label: 'Gato' },
]

const SEX_OPTIONS = [
  { value: 'male', label: 'Macho' },
  { value: 'female', label: 'Fêmea' },
]

const SIZE_OPTIONS = [
  { value: 'small', label: 'Pequeno' },
  { value: 'medium', label: 'Médio' },
  { value: 'large', label: 'Grande' },
]

const ARCHIVE_REASON_LABELS: Record<ArchiveReason, string> = {
  death: 'Falecimento',
  serious_illness: 'Doença grave',
  transfer: 'Transferência para outro lar/ONG',
  other: 'Outro',
}

const ADOPTION_REVERSAL_HELPER =
  'Para reverter uma adoção, altere o status da candidatura aprovada vinculada.'

const ARCHIVE_FILE_LINK_LABELS: Record<ArchiveFileType, string> = {
  contract: 'Ver termo de adoção',
  rejection: 'Ver PDF de rejeição',
  archivedAnimal: 'Ver documento de arquivamento',
}

type ArchiveLinkItem = {
  id: string
  label: string
}

function toArchiveLinkItem(file: ArchiveFile): ArchiveLinkItem {
  return {
    id: file.id,
    label: ARCHIVE_FILE_LINK_LABELS[file.type] ?? 'Ver arquivo relacionado',
  }
}

export function AnimalFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isEditing = !!id
  const { toast } = useToast()
  const { userProfile } = useAuthContext()
  const canDeleteAnimals = userProfile?.role === 'admin'

  const { data: animal, isLoading, error, refetch: refetchAnimal } = useAnimal(id)
  const { mutateAsync: createAnimal } = useCreateAnimal()
  const { mutateAsync: updateAnimal } = useUpdateAnimal()
  const { mutateAsync: updateAnimalStatus } = useUpdateAnimalStatus()
  const { mutateAsync: deleteAnimal, isPending: isDeletingAnimal } = useDeleteAnimal()
  const { mutate: archiveAnimal, isPending: isArchiving } = useArchiveAnimal()
  const {
    data: relatedArchiveFiles = [],
    hasMore: hasMoreRelatedArchiveFiles,
    isFetchingMore: isFetchingMoreRelatedArchiveFiles,
    fetchMore: fetchMoreRelatedArchiveFiles,
  } = useRelatedArchiveFiles({ animalId: animal?.id })

  useDocumentTitle(
    buildAdminTitle(
      isEditing
        ? animal?.name
          ? `Editar animal - ${animal.name}`
          : 'Editar animal'
        : 'Novo animal',
    ),
  )

  const [existingPhotos, setExistingPhotos] = useState<string[]>([])
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [vaccines, setVaccines] = useState<string[]>([''])
  const [coverIndex, setCoverIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null)
  const [isDeleteAnimalModalOpen, setIsDeleteAnimalModalOpen] = useState(false)
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [isSocialPostModalOpen, setIsSocialPostModalOpen] = useState(false)
  const [socialPostKey, setSocialPostKey] = useState(0)
  const [isSrd, setIsSrd] = useState(false)

  const {
    control,
    register,
    watch,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AnimalFormData>({
    // Cast needed: z.boolean().default() in Zod v4 infers differently in resolver type
    resolver: zodResolver(animalSchema) as unknown as Resolver<AnimalFormData>,
    defaultValues: { status: 'available', neutered: false },
  })

  const species = watch('species')
  const name = watch('name')
  const sex = watch('sex')
  const size = watch('size')
  const status = watch('status')
  const neutered = watch('neutered')

  // Populate form when animal loads (edit mode)
  useEffect(() => {
    if (!animal) return
    setExistingPhotos(animal.photos)
    setVaccines(animal.vaccines.length > 0 ? animal.vaccines : [''])
    setCoverIndex(animal.coverPhotoIndex)
    const srd = animal.breed === 'Sem raça definida'
    setIsSrd(srd)
    reset({
      name: animal.name,
      species: animal.species,
      sex: animal.sex,
      size: animal.size,
      isSrd: srd,
      breed: animal.breed ?? '',
      coatColor: animal.coatColor ?? '',
      estimatedAge: animal.estimatedAge ?? '',
      description: animal.description,
      neutered: animal.neutered,
      specialNeeds: animal.specialNeeds ?? '',
      status: animal.status,
    })
  }, [animal, reset])

  const removeExisting = (url: string) => {
    setExistingPhotos((prev) => prev.filter((u) => u !== url))
    setRemovedPhotos((prev) => [...prev, url])
    setCoverIndex(0)
  }

  const confirmRemoveExisting = () => {
    if (!photoToDelete) return
    removeExisting(photoToDelete)
    setPhotoToDelete(null)
  }

  const addVaccineField = () => {
    setVaccines((prev) => [...prev, ''])
  }

  const updateVaccineField = (index: number, value: string) => {
    setVaccines((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  const removeVaccineField = (index: number) => {
    setVaccines((prev) => {
      if (prev.length === 1) return ['']
      return prev.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const cleanedVaccines = vaccines
        .map((v) => v.trim())
        .filter(Boolean)

      const resolvedBreed = data.isSrd ? 'Sem raça definida' : data.breed.trim()
      const resolvedCoatColor = data.coatColor.trim()

      if (isEditing && animal) {
        // Upload new photos
        const uploadedUrls = await Promise.all(
          newFiles.map((f) => uploadAnimalPhoto(animal.id, f)),
        )
        // Delete removed photos from storage
        await Promise.all(removedPhotos.map(deleteAnimalPhoto))

        const allPhotos = [...existingPhotos, ...uploadedUrls]
        const safeCoverIndex = Math.min(coverIndex, Math.max(0, allPhotos.length - 1))

        await updateAnimal({
          id: animal.id,
          data: {
            name: data.name,
            species: data.species,
            sex: data.sex,
            size: data.size,
            breed: resolvedBreed,
            coatColor: resolvedCoatColor,
            estimatedAge: data.estimatedAge || undefined,
            description: data.description,
            neutered: data.neutered,
            specialNeeds: data.specialNeeds || undefined,
            vaccines: cleanedVaccines,
            photos: allPhotos,
            coverPhotoIndex: safeCoverIndex,
          },
        })

        if (data.status !== animal.status) {
          await updateAnimalStatus({ id: animal.id, status: data.status })
        }

        setExistingPhotos(allPhotos)
        setRemovedPhotos([])
        setNewFiles([])
        setCoverIndex(safeCoverIndex)
        await refetchAnimal()
        toast.success('Alterações salvas com sucesso.')
      } else {
        // Create first to get ID, then upload photos
        const animalId = await createAnimal({
          name: data.name,
          species: data.species,
          sex: data.sex,
          size: data.size,
          breed: resolvedBreed,
          coatColor: resolvedCoatColor,
          estimatedAge: data.estimatedAge || undefined,
          description: data.description,
          neutered: data.neutered,
          specialNeeds: data.specialNeeds || undefined,
          status: data.status,
          vaccines: cleanedVaccines,
          photos: [],
          coverPhotoIndex: 0,
        })

        if (newFiles.length > 0) {
          const uploadedUrls = await Promise.all(
            newFiles.map((f) => uploadAnimalPhoto(animalId, f)),
          )
          await updateAnimal({
            id: animalId,
            data: { photos: uploadedUrls, coverPhotoIndex: 0 },
          })
        }

        navigate('/admin/animais')
      }
    } catch (err) {
      setSubmitError(getAnimalSaveErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  })

  function handleStatusChange(value: string, fieldOnChange: (v: string) => void) {
    if (animal?.status === 'adopted' && value !== 'adopted') {
      setSubmitError(ADOPTION_REVERSAL_HELPER)
      return
    }

    if (value === 'archived' && isEditing && animal) {
      setIsArchiveModalOpen(true)
      return
    }
    fieldOnChange(value)
  }

  function handleConfirmArchive(reason: ArchiveReason, details: string, archiveDate: string) {
    if (!animal) return
    archiveAnimal(
      { animalId: animal.id, archiveReason: reason, archiveDetails: details, archiveDate },
      {
        onSuccess: () => navigate('/admin/animais'),
        onError: () => setSubmitError('Não foi possível arquivar o animal. Tente novamente.'),
      },
    )
  }

  const headerActions = useMemo(
    () => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => navigate('/admin/animais')}
      >
        <ArrowLeft size={14} />
        Animais
      </Button>
    ),
    [navigate],
  )

  useAdminPageHeader(useMemo(() => ({ actions: headerActions }), [headerActions]))

  const archiveLinkItems = useMemo(() => {
    const items = new Map<string, ArchiveLinkItem>()

    for (const file of relatedArchiveFiles) {
      items.set(file.id, toArchiveLinkItem(file))
    }

    if (animal?.adoptionContractArchiveFileId && !items.has(animal.adoptionContractArchiveFileId)) {
      items.set(animal.adoptionContractArchiveFileId, {
        id: animal.adoptionContractArchiveFileId,
        label: 'Ver termo de adoção',
      })
    }

    return Array.from(items.values())
  }, [animal?.adoptionContractArchiveFileId, relatedArchiveFiles])

  if (isEditing && isLoading) return <PageSpinner />
  if (isEditing && (error || !animal)) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <ErrorState description="Não foi possível carregar o animal." onRetry={() => window.location.reload()} />
      </div>
    )
  }

  const allPhotoCount = existingPhotos.length + newFiles.length
  const statusValue = status ?? animal?.status ?? 'available'
  const displayName = name?.trim() || animal?.name || 'Novo animal'
  const speciesLabel = species ? SPECIES_LABELS[species] : 'Espécie a definir'
  const statusOptions = isEditing
    ? animal?.status === 'adopted'
      ? ANIMAL_STATUS_OPTIONS.filter((option) => option.value === 'adopted')
      : ANIMAL_STATUS_OPTIONS
    : ANIMAL_STATUS_OPTIONS.filter((option) =>
      option.value === 'available' || option.value === 'under_review',
    )
  const statusHint = animal?.status === 'adopted' ? ADOPTION_REVERSAL_HELPER : undefined
  const profileHelper =
    [
      sex ? SEX_LABELS[sex] : null,
      species === 'dog' ? (size ? SIZE_LABELS[size] : 'Porte a definir') : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Complete os dados principais'
  const photoSummary = allPhotoCount
    ? `${allPhotoCount} foto${allPhotoCount !== 1 ? 's' : ''}`
    : 'Nenhuma foto'
  const vaccinesCount = vaccines.filter((value) => value.trim()).length
  const healthHelper = vaccinesCount > 0
    ? `${vaccinesCount} vacina${vaccinesCount !== 1 ? 's' : ''} listada${vaccinesCount !== 1 ? 's' : ''}`
    : 'Vacinas ainda não informadas'

  async function handleDeleteAnimal() {
    if (!animal) return

    setDeleteError(null)

    try {
      await deleteAnimal({ animalId: animal.id, reason: deleteReason })
      setDeleteReason('')
      navigate('/admin/animais')
    } catch (err) {
      const message = err instanceof Error && err.message.includes('candidaturas vinculadas')
        ? 'Este animal possui candidaturas vinculadas e não pode ser excluído.'
        : 'Não foi possível excluir o animal. Tente novamente.'
      setDeleteError(message)
      setDeleteReason('')
      setIsDeleteAnimalModalOpen(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <ArchiveAnimalModal
        open={isArchiveModalOpen}
        animalName={animal?.name ?? ''}
        onClose={() => setIsArchiveModalOpen(false)}
        onConfirm={handleConfirmArchive}
        loading={isArchiving}
      />

      {isEditing && animal && (
        <SocialPostModal
          key={socialPostKey}
          open={isSocialPostModalOpen}
          onClose={() => setIsSocialPostModalOpen(false)}
          animal={animal}
        />
      )}

      <ConfirmModal
        open={photoToDelete !== null}
        onClose={() => setPhotoToDelete(null)}
        onConfirm={confirmRemoveExisting}
        title="Remover foto?"
        description="Essa foto será removida deste cadastro quando você salvar as alterações."
        confirmLabel="Remover foto"
        cancelLabel="Cancelar"
        variant="danger"
      />

      <ConfirmModal
        open={isDeleteAnimalModalOpen}
        onClose={() => {
          setIsDeleteAnimalModalOpen(false)
          setDeleteReason('')
        }}
        onConfirm={handleDeleteAnimal}
        title="Excluir animal?"
        description="Essa ação remove o animal do sistema e apaga as fotos vinculadas. Não é possível desfazer."
        confirmLabel="Excluir animal"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isDeletingAnimal}
        confirmDisabled={!deleteReason.trim()}
      >
        <Textarea
          label="Motivo da exclusão"
          value={deleteReason}
          onChange={(event) => setDeleteReason(event.target.value)}
          rows={4}
          placeholder="Informe o motivo administrativo"
          disabled={isDeletingAnimal}
        />
      </ConfirmModal>

      {isEditing ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3 sm:hidden">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Editar {animal?.name}
            </h1>
            <AnimalStatusBadge status={statusValue} />
          </div>

          <h1 className="hidden text-2xl font-semibold tracking-tight text-foreground sm:block">
            Editar {animal?.name}
          </h1>

          <div className="hidden sm:block">
            <AnimalStatusBadge status={statusValue} />
          </div>
        </div>
      ) : (
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Novo animal
        </h1>
      )}

      <form
        onSubmit={onSubmit}
        className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <div className="flex flex-col gap-6">
          <Card data-tour="animal-form-basic" className="border-border/80 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-foreground">Informações principais</h2>
              <p className="text-sm text-muted-foreground">
                Dados que organizam a listagem e ajudam a equipe a identificar o perfil do animal.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="md:col-span-2 xl:col-span-3">
                <Input
                  label="Nome"
                  error={errors.name?.message}
                  required
                  {...register('name')}
                />
              </div>

              <Controller
                name="species"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Espécie"
                    options={SPECIES_OPTIONS}
                    placeholder="Selecione…"
                    error={errors.species?.message}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    required
                  />
                )}
              />

              <Controller
                name="sex"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Sexo"
                    options={SEX_OPTIONS}
                    placeholder="Selecione…"
                    error={errors.sex?.message}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    required
                  />
                )}
              />

              {species === 'dog' && (
                <Controller
                  name="size"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Porte"
                      options={SIZE_OPTIONS}
                      placeholder="Selecione…"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}

              <div className="flex flex-col gap-2">
                <Checkbox
                  label="Sem raça definida (SRD)"
                  checked={isSrd}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setIsSrd(checked)
                    setValue('breed', checked ? 'Sem raça definida' : '', { shouldValidate: false })
                  }}
                />
                {!isSrd && (
                  <Input
                    label="Raça"
                    placeholder="Ex: Siamês, Labrador..."
                    error={errors.breed?.message}
                    required
                    {...register('breed')}
                  />
                )}
              </div>

              <Input
                label="Pelagem e cor"
                placeholder="Ex: Pelo curto preto e branco"
                error={errors.coatColor?.message}
                required
                {...register('coatColor')}
              />

              <Input
                label="Idade estimada"
                placeholder="Ex: 2 anos, 6 meses"
                {...register('estimatedAge')}
              />
            </div>
          </Card>

          <Card data-tour="animal-form-photos" className="border-border/80 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-foreground">Fotos</h2>
              <p className="text-sm text-muted-foreground">
                Organize as imagens do perfil e escolha a capa entre as fotos já cadastradas.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {existingPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {existingPhotos.map((url, i) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-md border border-border bg-card">
                      <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-linear-to-t from-foreground/80 via-foreground/45 to-transparent p-2">
                        <button
                          type="button"
                          onClick={() => setCoverIndex(i)}
                          aria-label="Definir como capa"
                          aria-pressed={coverIndex === i}
                          className={cn(
                            'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                            coverIndex === i
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background/90 text-foreground hover:bg-primary hover:text-primary-foreground',
                          )}
                        >
                          <Star size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoToDelete(url)}
                          aria-label="Remover foto"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-danger transition-colors hover:bg-danger hover:text-danger-foreground"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {coverIndex === i && (
                        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                          <Star size={10} />
                          Capa
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <FileUpload
                label="Adicionar novas fotos"
                multiple
                maxFiles={Math.max(0, 10 - existingPhotos.length)}
                value={newFiles}
                onChange={setNewFiles}
              />

              {allPhotoCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {photoSummary} no total.
                </p>
              )}
            </div>
          </Card>

          <Card data-tour="animal-form-description" className="border-border/80 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-foreground">Descrição</h2>
              <p className="text-sm text-muted-foreground">
                Conte personalidade, comportamento, rotina e contexto do resgate para orientar a equipe.
              </p>
            </div>

            <div className="mt-5">
              <Textarea
                label="Descrição"
                placeholder="Conte sobre a personalidade, comportamento e histórico do animal…"
                rows={5}
                error={errors.description?.message}
                required
                {...register('description')}
              />
            </div>
          </Card>

          <Card data-tour="animal-form-health" className="border-border/80 p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-foreground">Saúde e cuidados</h2>
              <p className="text-sm text-muted-foreground">
                Registre castração, vacinas e necessidades especiais para manter o histórico claro.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <Checkbox
                label="Castrado"
                {...register('neutered')}
              />

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Vacinas</h3>
                    <p className="text-xs text-muted-foreground">
                      Adicione uma vacina por campo para deixar o histórico organizado.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={addVaccineField}
                  >
                    <Plus size={14} />
                    Adicionar vacina
                  </Button>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  {vaccines.map((vaccine, index) => (
                    <div key={`vaccine-${index}`} className="flex items-center gap-2">
                      <input
                        value={vaccine}
                        onChange={(event) => updateVaccineField(index, event.target.value)}
                        placeholder={`Ex: ${index === 0 ? 'V10' : 'Antirrábica'}`}
                        aria-label={`Vacina ${index + 1}`}
                        className={cn(
                          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
                          'transition-colors duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring',
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover vacina ${index + 1}`}
                        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-danger"
                        onClick={() => removeVaccineField(index)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Textarea
                label="Necessidades especiais"
                placeholder="Deixe em branco se não houver (opcional)"
                rows={3}
                {...register('specialNeeds')}
              />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6 xl:sticky xl:top-22 xl:self-start">
          <Card data-tour="animal-form-publication" className="border-border/80 p-5">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Publicação</h2>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Status"
                    options={statusOptions}
                    value={field.value}
                    onChange={(v) => handleStatusChange(v, field.onChange)}
                    onBlur={field.onBlur}
                    hint={statusHint}
                    required
                  />
                )}
              />

              <SidebarField label="Status atual" value={<AnimalStatusBadge status={statusValue} />} />
              <SidebarField label="Nome exibido" value={displayName} />
              <SidebarField label="Perfil" value={`${speciesLabel} · ${profileHelper}`} />
              <SidebarField label="Fotos" value={photoSummary} />
              <SidebarField label="Saúde" value={`${neutered ? 'Castrado' : 'Não castrado'} · ${healthHelper}`} />
            </div>
          </Card>

          {isEditing && animal && (
            <TraceabilityCard
              title="Rastreabilidade"
              rows={[
                { label: 'Status atual', value: STATUS_LABELS[animal.status] },
                { label: 'Última atualização', value: formatTraceDate(animal.updatedAt) },
                { label: 'Atualizado por', value: formatActorLabel(animal.updatedByLabel) },
                { label: 'Arquivado em', value: formatTraceDate(animal.archivedAt) },
                { label: 'Arquivado por', value: formatActorLabel(animal.archivedByLabel) },
                { label: 'Data informada do arquivamento', value: formatTraceDate(animal.archiveDate) },
                {
                  label: 'Motivo do arquivamento',
                  value: animal.archiveReason ? ARCHIVE_REASON_LABELS[animal.archiveReason] : undefined,
                },
                { label: 'Detalhes do arquivamento', value: animal.archiveDetails },
              ]}
            />
          )}

          {isEditing && animal?.status === 'adopted' && animal.adoptedApplicationId && (
            <Card className="border-border/80 p-5">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Adoção aprovada</h2>
              </div>
              <div className="mt-4">
                <Link
                  to={`/admin/candidaturas/${animal.adoptedApplicationId}`}
                  state={{ from: 'animal-detail', animalId: animal.id }}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <ClipboardList size={14} />
                  Ver candidatura aprovada
                </Link>
              </div>
            </Card>
          )}

          {isEditing && animal && archiveLinkItems.length > 0 && (
            <Card className="border-border/80 p-5">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Documentos relacionados</h2>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {archiveLinkItems.map((item) => (
                  <Link
                    key={item.id}
                    to={`/admin/arquivos/${item.id}`}
                    state={{ backTo: `${location.pathname}${location.search}` }}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <FileText size={14} />
                    {item.label}
                  </Link>
                ))}
                {hasMoreRelatedArchiveFiles && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit text-primary"
                    loading={isFetchingMoreRelatedArchiveFiles}
                    onClick={() => fetchMoreRelatedArchiveFiles()}
                  >
                    Carregar mais documentos
                  </Button>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Os arquivos usam a rota interna de arquivos e são exibidos com acesso temporário.
                </p>
              </div>
            </Card>
          )}

          <Card data-tour="animal-form-actions" className="border-border/80 p-5">
            <h2 className="text-sm font-semibold text-foreground">Ações</h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(submitError || deleteError) && (
                <p role="alert" className="text-sm text-danger sm:col-span-2">
                  {submitError ?? deleteError}
                </p>
              )}

              <Button type="submit" disabled={submitting} className="w-full gap-1.5">
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar animal'}
              </Button>

              <Link to="/admin/animais" className="w-full">
                <Button type="button" variant="outline" className="w-full">
                  Cancelar
                </Button>
              </Link>

              {isEditing && animal && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-1.5 sm:col-span-2"
                  onClick={() => {
                    setSocialPostKey((k) => k + 1)
                    setIsSocialPostModalOpen(true)
                  }}
                >
                  <Share2 size={16} />
                  Criar arte de divulgação
                </Button>
              )}

              {isEditing && animal && canDeleteAnimals && (
                <Button
                  type="button"
                  variant="danger"
                  className="w-full gap-1.5 sm:col-span-2"
                  onClick={() => {
                    setDeleteError(null)
                    setDeleteReason('')
                    setIsDeleteAnimalModalOpen(true)
                  }}
                >
                  <Trash2 size={16} />
                  Excluir animal
                </Button>
              )}

              <p className="text-xs text-muted-foreground sm:col-span-2">
                As alterações só são aplicadas quando você salvar o formulário.
              </p>
            </div>
          </Card>
        </div>
      </form>
    </div>
  )
}

function SidebarField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  )
}

function getAnimalSaveErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'Ocorreu um erro ao salvar. Verifique sua conexão e tente novamente.'
  }

  if (err.message.includes('permission-denied')) {
    return 'Você não tem permissão para salvar animais.'
  }

  if (err.message.includes('reversão de uma adoção')) {
    return ADOPTION_REVERSAL_HELPER
  }

  if (err.message.includes('storage/unauthorized')) {
    return 'Você não tem permissão para enviar fotos.'
  }

  if (err.message.includes('storage/unauthenticated')) {
    return 'Sua sessão expirou. Entre novamente para enviar fotos.'
  }

  if (err.message.includes('Unsupported field value: undefined')) {
    return 'Alguns campos opcionais foram enviados de forma inválida. Tente novamente.'
  }

  return 'Ocorreu um erro ao salvar. Verifique sua conexão e tente novamente.'
}
