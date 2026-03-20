import { AnimatePresence, motion } from 'framer-motion'
import { FormProvider } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui'
import { Stepper } from '@/components/ui/stepper'
import type { Animal } from '@/features/animals/types/animal.types'
import { useAdoptionForm } from '../hooks/use-adoption-form'
import { STEP_LABELS } from '../config/form-config'
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
    currentStep,
    totalSteps,
    isLastStep,
    goNext,
    goBack,
    handleSubmit,
    isSubmitting,
    submitError,
    isSuccess,
  } = useAdoptionForm(animal)

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
            Recebemos sua candidatura para adotar{' '}
            <strong className="text-foreground">{animal.name}</strong>. Nossa
            equipe vai analisar e entrar em contato em até 5 dias úteis.
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
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-8">
          <Stepper steps={STEP_LABELS} currentStep={currentStep} />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 1 && <StepIdentification />}
              {currentStep === 2 && (
                <StepPetPreferences species={animal.species} />
              )}
              {currentStep === 3 && <StepHousehold />}
              {currentStep === 4 && (
                <StepLifestyle species={animal.species} />
              )}
              {currentStep === 5 && (
                <StepHousing species={animal.species} />
              )}
              {currentStep === 6 && (
                <StepPetHistory species={animal.species} />
              )}
              {currentStep === 7 && <StepResponsibility />}
              {currentStep === 8 && <StepAgreements />}
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
  )
}
