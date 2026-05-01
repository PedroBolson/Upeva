import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Dog, Cat, ArrowLeft, PawPrint } from 'lucide-react'
import { Button } from '@/components/ui'
import { AdoptionForm } from '@/features/adoption/components/adoption-form'
import { ConsentModal } from '@/features/adoption/components/consent-modal'
import type { Animal } from '@/features/animals/types/animal.types'
import type { Species } from '@/types/common'
import { buildPublicTitle, useDocumentTitle } from '@/utils/page-title'

const SPECIES_OPTIONS: { value: Species; label: string; icon: typeof Dog; description: string }[] = [
  { value: 'dog', label: 'Cachorro', icon: Dog, description: 'Quero adotar um cão' },
  { value: 'cat', label: 'Gato', icon: Cat, description: 'Quero adotar um gato' },
]

function buildMockAnimal(species: Species): Animal {
  return {
    id: '',
    name: 'interesse geral',
    species,
    sex: 'male',
    description: '',
    photos: [],
    coverPhotoIndex: 0,
    status: 'available',
    vaccines: [],
    neutered: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt: null as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedAt: null as any,
  }
}

export function AdoptionGeneralPage() {
  useDocumentTitle(buildPublicTitle('Quero adotar'))
  const [searchParams] = useSearchParams()
  const [species, setSpecies] = useState<Species | null>(() => {
    const initialSpecies = searchParams.get('especie')
    if (initialSpecies === 'dog' || initialSpecies === 'cat') {
      return initialSpecies
    }
    return null
  })
  const [consentGiven, setConsentGiven] = useState(false)

  if (species) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-20 pb-10 sm:pt-24">
        <ConsentModal open={!consentGiven} onAccept={() => setConsentGiven(true)} />
        <button
          onClick={() => setSpecies(null)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Trocar espécie
        </button>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Formulário de adoção</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Preencha o formulário e nossa equipe entrará em contato para indicar o melhor animal para você.
          </p>
        </div>
        <AdoptionForm animal={buildMockAnimal(species)} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-20 pb-16 sm:pt-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-8 text-center"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Quero adotar</h1>
          <p className="text-muted-foreground">
            Selecione a espécie que você tem interesse em adotar para começar.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          {SPECIES_OPTIONS.map(({ value, label, icon: Icon, description }) => (
            <button
              key={value}
              onClick={() => setSpecies(value)}
              className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center transition-all hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Icon className="text-primary" size={28} strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground max-w-xs">
          Caso prefira, confira nossa{' '}
          <Link
            to="/animais"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            <PawPrint size={13} />
            vitrine virtual
          </Link>
          {' '}e encontre seu novo amigo!
        </p>

        <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="text-muted-foreground">
          Voltar
        </Button>
      </motion.div>
    </div>
  )
}
