import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2, Star, X } from 'lucide-react'
import { Button, Input, Select, Checkbox } from '@/components/ui'
import { Textarea } from '@/components/ui/textarea'
import { FileUpload } from '@/components/ui/file-upload'
import { PageSpinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useAnimal } from '@/features/animals/hooks/use-animal'
import { useCreateAnimal, useUpdateAnimal } from '@/features/animals/hooks/use-animal-mutations'
import { uploadAnimalPhoto, deleteAnimalPhoto } from '@/features/animals/services/animal-storage.service'
import { animalSchema, type AnimalFormData } from '@/features/animals/schemas/animal.schema'
import { cn } from '@/utils/cn'

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

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponível' },
  { value: 'under_review', label: 'Em análise' },
  { value: 'adopted', label: 'Adotado' },
  { value: 'archived', label: 'Arquivado' },
]

export function AnimalFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id

  const { data: animal, isLoading, error } = useAnimal(id)
  const { mutateAsync: createAnimal } = useCreateAnimal()
  const { mutateAsync: updateAnimal } = useUpdateAnimal()

  const [existingPhotos, setExistingPhotos] = useState<string[]>([])
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [coverIndex, setCoverIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AnimalFormData>({
    // Cast needed: z.boolean().default() in Zod v4 infers differently in resolver type
    resolver: zodResolver(animalSchema) as unknown as Resolver<AnimalFormData>,
    defaultValues: { status: 'available', neutered: false },
  })

  const species = watch('species')

  // Populate form when animal loads (edit mode)
  useEffect(() => {
    if (!animal) return
    setExistingPhotos(animal.photos)
    setCoverIndex(animal.coverPhotoIndex)
    reset({
      name: animal.name,
      species: animal.species,
      sex: animal.sex,
      size: animal.size,
      breed: animal.breed ?? '',
      estimatedAge: animal.estimatedAge ?? '',
      description: animal.description,
      neutered: animal.neutered,
      specialNeeds: animal.specialNeeds ?? '',
      status: animal.status,
      vaccinesText: animal.vaccines.join('\n'),
    })
  }, [animal, reset])

  const removeExisting = (url: string) => {
    setExistingPhotos((prev) => prev.filter((u) => u !== url))
    setRemovedPhotos((prev) => [...prev, url])
    setCoverIndex(0)
  }

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const vaccines = (data.vaccinesText ?? '')
        .split('\n')
        .map((v) => v.trim())
        .filter(Boolean)

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
            breed: data.breed || undefined,
            estimatedAge: data.estimatedAge || undefined,
            description: data.description,
            neutered: data.neutered,
            specialNeeds: data.specialNeeds || undefined,
            status: data.status,
            vaccines,
            photos: allPhotos,
            coverPhotoIndex: safeCoverIndex,
          },
        })
      } else {
        // Create first to get ID, then upload photos
        const animalId = await createAnimal({
          name: data.name,
          species: data.species,
          sex: data.sex,
          size: data.size,
          breed: data.breed || undefined,
          estimatedAge: data.estimatedAge || undefined,
          description: data.description,
          neutered: data.neutered,
          specialNeeds: data.specialNeeds || undefined,
          status: data.status,
          vaccines,
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
      }

      navigate('/admin/animais')
    } catch (err) {
      setSubmitError(getAnimalSaveErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  })

  if (isEditing && isLoading) return <PageSpinner />
  if (isEditing && (error || !animal)) {
    return (
      <div className="max-w-xl">
        <ErrorState description="Não foi possível carregar o animal." onRetry={() => window.location.reload()} />
      </div>
    )
  }

  const allPhotoCount = existingPhotos.length + newFiles.length

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          to="/admin/animais"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Voltar para Animais
        </Link>
        <h1 className="text-2xl font-bold text-foreground">
          {isEditing ? `Editar ${animal?.name}` : 'Cadastrar animal'}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        {/* Photos */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-foreground">Fotos</span>

          {/* Existing photo previews */}
          {existingPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {existingPhotos.map((url, i) => (
                <div key={url} className="relative aspect-square rounded-md overflow-hidden group">
                  <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCoverIndex(i)}
                      title="Definir como capa"
                      className={cn(
                        'rounded-full p-1 transition-colors',
                        coverIndex === i
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-white/80 text-foreground hover:bg-primary hover:text-primary-foreground',
                      )}
                    >
                      <Star size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeExisting(url)}
                      title="Remover foto"
                      className="rounded-full p-1 bg-white/80 text-danger hover:bg-danger hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {coverIndex === i && (
                    <div className="absolute top-1 left-1 bg-primary rounded-full p-0.5">
                      <Star size={10} className="text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <FileUpload
            multiple
            maxFiles={10 - existingPhotos.length}
            value={newFiles}
            onChange={setNewFiles}
          />
          {allPhotoCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {allPhotoCount} foto{allPhotoCount !== 1 ? 's' : ''} no total
            </p>
          )}
        </div>

        {/* Basic info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Nome"
              error={errors.name?.message}
              required
              {...register('name')}
            />
          </div>

          <Select
            label="Espécie"
            options={SPECIES_OPTIONS}
            placeholder="Selecione…"
            error={errors.species?.message}
            required
            {...register('species')}
          />

          <Select
            label="Sexo"
            options={SEX_OPTIONS}
            placeholder="Selecione…"
            error={errors.sex?.message}
            required
            {...register('sex')}
          />

          {species === 'dog' && (
            <Select
              label="Porte"
              options={SIZE_OPTIONS}
              placeholder="Selecione…"
              {...register('size')}
            />
          )}

          <Input
            label="Raça"
            placeholder="Ex: Vira-lata (opcional)"
            {...register('breed')}
          />

          <Input
            label="Idade estimada"
            placeholder="Ex: 2 anos, 6 meses"
            {...register('estimatedAge')}
          />

          <Select
            label="Status"
            options={STATUS_OPTIONS}
            required
            {...register('status')}
          />
        </div>

        {/* Description */}
        <Textarea
          label="Descrição"
          placeholder="Conte sobre a personalidade, comportamento e histórico do animal…"
          rows={4}
          error={errors.description?.message}
          required
          {...register('description')}
        />

        {/* Health */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">Saúde</h2>

          <Checkbox
            label="Castrado"
            {...register('neutered')}
          />

          <Textarea
            label="Vacinas"
            placeholder={"V10\nAntirrábica\nBordadella"}
            rows={3}
            hint="Uma vacina por linha."
            {...register('vaccinesText')}
          />

          <Textarea
            label="Necessidades especiais"
            placeholder="Deixe em branco se não houver (opcional)"
            rows={2}
            {...register('specialNeeds')}
          />
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-danger">
            {submitError}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Cadastrar animal'}
          </Button>
          <Link to="/admin/animais">
            <Button type="button" variant="outline">Cancelar</Button>
          </Link>
        </div>
      </form>
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
