import { AlertCircle, ExternalLink, Scissors, Syringe, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Modal } from '@/components/ui/modal'
import { Badge, AnimalStatusBadge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/utils/cn'
import { AnimalPhotoGallery } from './animal-photo-gallery'
import { useAnimal } from '../hooks/use-animal'
import { SPECIES_LABELS, SEX_LABELS, SIZE_LABELS } from '../types/animal.types'

interface AnimalQuickViewModalProps {
  animalId: string | undefined
  animalName?: string
  open: boolean
  onClose: () => void
}

export function AnimalQuickViewModal({
  animalId,
  animalName,
  open,
  onClose,
}: AnimalQuickViewModalProps) {
  const { data: animal, isLoading, isError } = useAnimal(animalId)

  const infoChips = animal
    ? [
        { label: 'Sexo', value: SEX_LABELS[animal.sex] },
        ...(animal.species === 'dog' && animal.size
          ? [{ label: 'Porte', value: SIZE_LABELS[animal.size] }]
          : []),
        ...(animal.breed ? [{ label: 'Raça', value: animal.breed }] : []),
        ...(animal.estimatedAge
          ? [{ label: 'Idade', value: animal.estimatedAge }]
          : []),
      ]
    : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={animal?.name ?? animalName}
      size="xl"
      className="sm:max-w-2xl"
      footer={
        animal ? (
          <Link
            to={`/animais/${animal.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink size={13} />
            Ver página completa
          </Link>
        ) : undefined
      }
    >
      {isLoading && (
        <div className="flex min-h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar os dados do animal.
        </p>
      )}

      {animal && (
        <div className="max-h-[70vh] overflow-y-auto flex flex-col gap-5 sm:flex-row sm:gap-6 pr-1">
          <div className="sm:w-1/2 sm:shrink-0">
            <AnimalPhotoGallery
              photos={animal.photos}
              animalName={animal.name}
              coverPhotoIndex={animal.coverPhotoIndex}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <AnimalStatusBadge status={animal.status} />
              <Badge variant="outline">{SPECIES_LABELS[animal.species]}</Badge>
            </div>

            {infoChips.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {infoChips.map((chip) => (
                  <div
                    key={chip.label}
                    className="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <span className="text-xs text-muted-foreground">{chip.label}</span>
                    <span className="text-sm font-semibold text-foreground">{chip.value}</span>
                  </div>
                ))}
              </div>
            )}

            {animal.description && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Sobre {animal.name}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {animal.description}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Saúde
              </h3>
              <div className="flex flex-col gap-1.5">
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
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function HealthItem({
  icon: Icon,
  label,
  positive,
  neutral = false,
}: {
  icon: LucideIcon
  label: string
  positive: boolean
  neutral?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        size={16}
        className={cn(
          'mt-0.5 shrink-0',
          neutral
            ? 'text-warning'
            : positive
              ? 'text-success'
              : 'text-muted-foreground',
        )}
      />
      <span className="text-sm text-foreground">{label}</span>
    </div>
  )
}
