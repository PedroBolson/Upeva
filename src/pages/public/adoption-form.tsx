import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { PawPrint, ArrowLeft, AlertCircle } from 'lucide-react'
import { PageSpinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useAnimal } from '@/features/animals/hooks/use-animal'
import { AdoptionForm } from '@/features/adoption/components/adoption-form'
import { SPECIES_LABELS } from '@/features/animals/types/animal.types'

export function AdoptionFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: animal, isLoading, error, refetch } = useAnimal(id)

  useEffect(() => {
    if (animal) document.title = `Adotar ${animal.name} — Upeva`
    return () => { document.title = 'Upeva — Adoção responsável de animais' }
  }, [animal])

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

  const isWaitlistOpen = animal.status === 'under_review'

  if (animal.status !== 'available' && !isWaitlistOpen) {
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
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Voltar para {animal.name}
        </button>

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
              {isWaitlistOpen ? `Fila de espera para ${animal.name}` : `Adotar ${animal.name}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {SPECIES_LABELS[animal.species]} · Formulário de candidatura
            </p>
          </div>
        </div>

        {isWaitlistOpen && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15">
              <AlertCircle size={18} className="text-warning" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">
                {animal.name} já está em processo de adoção.
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Você pode preencher este formulário para entrar na fila de espera.
                Se surgir uma possibilidade, nossa equipe entrará em contato.
              </p>
            </div>
          </div>
        )}
      </div>

      <AdoptionForm animal={animal} />
    </div>
  )
}
