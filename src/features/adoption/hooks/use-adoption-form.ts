import { useState, useCallback } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Animal } from '@/features/animals/types/animal.types'
import { createAdoptionSchema } from '../schemas/adoption.schema'
import { getLogicalStep, getStepFields, getStepLabels } from '../config/form-config'
import { createApplication } from '../services/adoption.service'
import type { AdoptionFormData } from '../types/adoption.types'

export function useAdoptionForm(animal: Animal) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [waitlistEntry, setWaitlistEntry] = useState(false)
  const [queuePosition, setQueuePosition] = useState(0)
  const hasSpecificAnimal = Boolean(animal.id)
  const steps = getStepLabels(hasSpecificAnimal)
  const totalSteps = steps.length
  const logicalStep = getLogicalStep(currentStep, hasSpecificAnimal)

  const form = useForm<AdoptionFormData>({
    mode: 'onBlur',
    resolver: zodResolver(
      createAdoptionSchema(animal.species, hasSpecificAnimal),
    ) as unknown as Resolver<AdoptionFormData>,
    defaultValues: {
      fullName: '',
      cpf: '',
      email: '',
      birthDate: '',
      phone: '',
      cep: '',
      address: {
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
      },
      adultsCount: 1,
      childrenCount: 0,
      adoptionReason: '',
      hoursHomePeoplePerDay: 8,
      scratchBehaviorResponse: '',
      escapeResponse: '',
      cannotKeepResponse: '',
      comments: '',
    },
  })

  const goNext = useCallback(async () => {
    const values = form.getValues()
    const currentLogicalStep = getLogicalStep(currentStep, hasSpecificAnimal)
    const fields = getStepFields(currentLogicalStep, animal.species, values)
    const valid = await form.trigger(fields as Parameters<typeof form.trigger>[0])
    if (!valid) return
    setCurrentStep((s) => Math.min(s + 1, totalSteps))
  }, [currentStep, animal.species, form, hasSpecificAnimal, totalSteps])

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }, [])

  const handleSubmit = form.handleSubmit(async (data) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await createApplication(
        hasSpecificAnimal ? animal.id : undefined,
        hasSpecificAnimal ? animal.name : undefined,
        animal.species,
        data,
      )
      setApplicationId(result.id)
      setWaitlistEntry(result.waitlistEntry)
      setQueuePosition(result.queuePosition)
    } catch {
      setSubmitError(
        'Não foi possível enviar sua candidatura. Verifique sua conexão e tente novamente.',
      )
    } finally {
      setIsSubmitting(false)
    }
  })

  return {
    form,
    steps,
    currentStep,
    logicalStep,
    totalSteps,
    isLastStep: currentStep === totalSteps,
    goNext,
    goBack,
    handleSubmit,
    isSubmitting,
    submitError,
    applicationId,
    waitlistEntry,
    queuePosition,
    hasSpecificAnimal,
    isSuccess: applicationId !== null,
  }
}
