import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Heart,
  Syringe,
  Scissors,
  AlertCircle,
  PawPrint,
} from 'lucide-react'
import {
  Button,
  Badge,
  AnimalStatusBadge,
  Skeleton,
  ErrorState,
} from '@/components/ui'
import { AnimalPhotoGallery } from '@/features/animals/components/animal-photo-gallery'
import { AnimalCard } from '@/features/animals/components/animal-card'
import { useAnimal } from '@/features/animals/hooks/use-animal'
import { useSimilarAnimals } from '@/features/animals/hooks/use-animals'
import {
  SPECIES_LABELS,
  SEX_LABELS,
  SIZE_LABELS,
} from '@/features/animals/types/animal.types'

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

export function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: animal, isLoading, error, refetch } = useAnimal(id)
  const { data: similar = [] } = useSimilarAnimals(animal ?? undefined)

  if (isLoading) return <DetailSkeleton />

  if (error || (!isLoading && animal === null)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState
          title={animal === null ? 'Animal não encontrado' : undefined}
          description={
            animal === null
              ? 'Este animal pode ter sido adotado ou removido.'
              : 'Não foi possível carregar as informações. Tente novamente.'
          }
          onRetry={animal === null ? undefined : refetch}
        />
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => navigate('/animais')} className="gap-2">
            <ArrowLeft size={16} />
            Ver outros animais
          </Button>
        </div>
      </div>
    )
  }

  if (!animal) return null

  const isWaitlistOpen = animal.status === 'under_review'
  const canApply = animal.status === 'available' || isWaitlistOpen
  const detailChips = [
    { label: 'Sexo', value: SEX_LABELS[animal.sex] },
    ...(animal.species === 'dog' && animal.size
      ? [{ label: 'Porte', value: SIZE_LABELS[animal.size] }]
      : []),
    ...(animal.breed
      ? [{ label: 'Raça', value: animal.breed }]
      : []),
    ...(animal.estimatedAge
      ? [{ label: 'Idade', value: animal.estimatedAge, breakOnComma: true }]
      : []),
  ]
  const detailGridColsClass = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
  }[detailChips.length] ?? 'lg:grid-cols-4'

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>
      </motion.div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-10"
      >
        <motion.div variants={fadeUp}>
          <AnimalPhotoGallery
            photos={animal.photos}
            animalName={animal.name}
            coverPhotoIndex={animal.coverPhotoIndex}
          />
        </motion.div>

        <motion.div variants={stagger} className="flex flex-col gap-6">
          <motion.div variants={fadeUp} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <AnimalStatusBadge status={animal.status} />
              <Badge variant="outline">
                {SPECIES_LABELS[animal.species]}
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              {animal.name}
            </h1>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className={`grid grid-cols-2 gap-3 ${detailGridColsClass}`}
          >
            {detailChips.map((chip) => (
              <InfoChip
                key={chip.label}
                label={chip.label}
                value={chip.value}
                breakOnComma={chip.breakOnComma}
              />
            ))}
          </motion.div>

          {animal.description && (
            <motion.div variants={fadeUp} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Sobre {animal.name}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {animal.description}
              </p>
            </motion.div>
          )}

          <motion.div variants={fadeUp} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Saúde
            </h2>
            <div className="flex flex-col gap-2">
              <HealthItem
                icon={Scissors}
                label={animal.neutered ? 'Castrado(a)' : 'Não castrado(a)'}
                positive={animal.neutered}
              />
              {animal.vaccines.length > 0 && (
                <HealthItem
                  icon={Syringe}
                  label={`Vacinas: ${animal.vaccines.join(', ')}`}
                  positive
                />
              )}
              {animal.specialNeeds && (
                <HealthItem
                  icon={AlertCircle}
                  label={`Necessidades especiais: ${animal.specialNeeds}`}
                  positive={false}
                  neutral
                />
              )}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-col gap-3 pt-2">
            {animal.status === 'available' ? (
              <>
                <Link to={`/adotar/${animal.id}`}>
                  <Button size="lg" className="w-full gap-2">
                    <Heart size={18} />
                    Quero adotar {animal.name}
                  </Button>
                </Link>
                <p className="text-xs text-center text-muted-foreground">
                  Preencha o formulário e nossa equipe entrará em contato.
                </p>
              </>
            ) : isWaitlistOpen && canApply ? (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-center">
                <p className="text-sm text-foreground">
                  {animal.name} já está em processo de adoção.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você ainda pode enviar sua candidatura para entrar na fila de espera.
                </p>
                <Link to={`/adotar/${animal.id}`} className="mt-4 inline-block">
                  <Button className="gap-2">
                    <Heart size={16} />
                    Entrar na fila de espera
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {animal.name} não está disponível para adoção no momento.
                </p>
                <Link to="/animais" className="mt-3 inline-block">
                  <Button variant="outline" size="sm" className="gap-2">
                    <PawPrint size={14} />
                    Ver outros animais
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>

      {similar.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mt-16 flex flex-col gap-6"
        >
          <h2 className="text-xl font-bold text-foreground">
            Animais parecidos com {animal.name}
          </h2>
          <div className="relative">
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {similar.map((a) => (
                <div key={a.id} className="min-w-65 max-w-80 flex-none snap-start md:min-w-0 md:max-w-none">
                  <AnimalCard animal={a} className="h-full" />
                </div>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-background to-transparent md:hidden"
            />
          </div>
        </motion.div>
      )}
    </div>
  )
}

function InfoChip({
  label,
  value,
  breakOnComma = false,
}: {
  label: string
  value: string
  breakOnComma?: boolean
}) {
  const formattedValue = breakOnComma ? value.replace(/,\s+/g, ',\n') : value

  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line text-sm font-semibold leading-tight text-foreground">
        {formattedValue}
      </span>
    </div>
  )
}

function HealthItem({
  icon: Icon,
  label,
  positive,
  neutral = false,
}: {
  icon: React.ElementType
  label: string
  positive: boolean
  neutral?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        size={16}
        className={
          neutral
            ? 'text-warning mt-0.5 shrink-0'
            : positive
            ? 'text-success mt-0.5 shrink-0'
            : 'text-muted-foreground mt-0.5 shrink-0'
        }
      />
      <span className="text-sm text-foreground">{label}</span>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <Skeleton className="h-4 w-16 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Skeleton className="aspect-4/3 rounded-xl" />
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
