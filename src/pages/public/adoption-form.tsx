import { useParams, Link } from 'react-router-dom'
import { PawPrint, ArrowLeft } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useAnimal } from '@/features/animals/hooks/use-animal'
import { AdoptionForm } from '@/features/adoption/components/adoption-form'
import { SPECIES_LABELS } from '@/features/animals/types/animal.types'

export function AdoptionFormPage() {
  const { id } = useParams<{ id: string }>()
  const { data: animal, isLoading, error, refetch } = useAnimal(id)

  if (isLoading) return <PageSpinner />

  if (error || !animal) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState
          description="Não foi possível carregar os dados do animal."
          onRetry={refetch}
        />
      </div>
    )
  }

  if (animal.status !== 'available') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <PawPrint className="text-muted-foreground" size={28} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {animal.name} não está disponível para adoção
          </h1>
          <p className="text-muted-foreground mt-1">
            Este animal já foi adotado ou está em processo de análise.
          </p>
        </div>
        <Link
          to="/animais"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          Ver outros animais disponíveis
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 w-full">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={`/animais/${animal.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Voltar para {animal.name}
        </Link>

        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full overflow-hidden bg-muted shrink-0">
            {animal.photos[animal.coverPhotoIndex] ? (
              <img
                src={animal.photos[animal.coverPhotoIndex]}
                alt={animal.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <PawPrint size={20} className="text-muted-foreground" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Adotar {animal.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {SPECIES_LABELS[animal.species]} · Formulário de candidatura
            </p>
          </div>
        </div>
      </div>

      <AdoptionForm animal={animal} />
    </div>
  )
}
