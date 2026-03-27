import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FormProvider } from 'react-hook-form'
import { Link, useBlocker } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Stepper } from '@/components/ui/stepper'
import type { Animal } from '@/features/animals/types/animal.types'
import { SPECIES_LABELS } from '@/features/animals/types/animal.types'
import { useAdoptionForm } from '../hooks/use-adoption-form'
import { StepIdentification } from './steps/step-identification'
import { StepPetPreferences } from './steps/step-pet-preferences'
import { StepHousehold } from './steps/step-household'
import { StepLifestyle } from './steps/step-lifestyle'
import { StepHousing } from './steps/step-housing'
import { StepPetHistory } from './steps/step-pet-history'
import { StepResponsibility } from './steps/step-responsibility'
import { StepAgreements } from './steps/step-agreements'

interface Props {
  animal: Animal
}

export function AdoptionForm({ animal }: Props) {
  const {
    form,
    steps,
    currentStep,
    logicalStep,
    totalSteps,
    isLastStep,
    goNext,
    goBack,
    handleSubmit,
    isSubmitting,
    submitError,
    hasSpecificAnimal,
    waitlistEntry,
    queuePosition,
    isSuccess,
  } = useAdoptionForm(animal)

  const isDirty = form.formState.isDirty

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !isSuccess && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!isDirty || isSuccess) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, isSuccess])

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6 py-16 text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle className="text-success" size={40} strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-2 max-w-md">
          <h2 className="text-2xl font-bold text-foreground">
            Candidatura enviada!
          </h2>
          <p className="text-muted-foreground">
            {hasSpecificAnimal ? (
              waitlistEntry ? (
                <>
                  Você está na{' '}
                  <strong className="text-foreground">posição {queuePosition} da fila</strong>{' '}
                  para <strong className="text-foreground">{animal.name}</strong>.{' '}
                  {queuePosition === 2
                    ? 'Há uma candidatura em análise na sua frente — se não for aprovada, entraremos em contato com você.'
                    : 'Caso as candidaturas à frente não sejam aprovadas, entraremos em contato.'
                  }{' '}
                  Obrigado pelo interesse!
                </>
              ) : (
                <>
                  Recebemos sua candidatura para adotar{' '}
                  <strong className="text-foreground">{animal.name}</strong>. Nossa
                  equipe vai analisar e entrar em contato em até 5 dias úteis.
                </>
              )
            ) : (
              <>
                Recebemos sua candidatura para adoção de{' '}
                <strong className="text-foreground">
                  {SPECIES_LABELS[animal.species].toLowerCase()}
                </strong>
                . Nossa equipe vai analisar seu perfil e entrar em contato em até
                5 dias úteis.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/animais">
            <Button variant="outline">Ver outros animais</Button>
          </Link>
          <Link to="/">
            <Button>Voltar ao início</Button>
          </Link>
        </div>
      </motion.div>
    )
  }

  return (
    <>
    <ConfirmModal
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
      title="Sair do formulário?"
      description="Você tem informações preenchidas que serão perdidas se sair agora."
      confirmLabel="Sair mesmo assim"
      cancelLabel="Continuar preenchendo"
      variant="warning"
    />
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-8">
          <Stepper steps={steps} currentStep={currentStep} />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {logicalStep === 1 && <StepIdentification />}
              {logicalStep === 2 && (
                <StepPetPreferences species={animal.species} />
              )}
              {logicalStep === 3 && <StepHousehold />}
              {logicalStep === 4 && (
                <StepLifestyle species={animal.species} />
              )}
              {logicalStep === 5 && (
                <StepHousing species={animal.species} />
              )}
              {logicalStep === 6 && (
                <StepPetHistory species={animal.species} />
              )}
              {logicalStep === 7 && <StepResponsibility />}
              {logicalStep === 8 && <StepAgreements />}
            </motion.div>
          </AnimatePresence>

          {submitError && (
            <p role="alert" className="text-sm text-danger text-center">
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={currentStep === 1 || isSubmitting}
              className="gap-1.5"
            >
              <ArrowLeft size={16} />
              Anterior
            </Button>

            <span className="text-xs text-muted-foreground">
              {currentStep} / {totalSteps}
            </span>

            {isLastStep ? (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Enviar candidatura
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={goNext}
                disabled={isSubmitting}
                className="gap-1.5"
              >
                Próximo
                <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
    </>
  )
}
