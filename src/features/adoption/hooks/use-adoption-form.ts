import { useState, useCallback } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Animal } from '@/features/animals/types/animal.types'
import { createAdoptionSchema } from '../schemas/adoption.schema'
import { getStepFields, TOTAL_STEPS } from '../config/form-config'
import { createApplication } from '../services/adoption.service'
import type { AdoptionFormData } from '../types/adoption.types'

const DRAFT_KEY = (animalId: string) => `upeva-adoption-${animalId}`

function loadDraft(animalId: string): Partial<AdoptionFormData> {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY(animalId))
    return raw ? (JSON.parse(raw) as Partial<AdoptionFormData>) : {}
  } catch {
    return {}
  }
}

function saveDraft(animalId: string, data: Partial<AdoptionFormData>) {
  try {
    sessionStorage.setItem(DRAFT_KEY(animalId), JSON.stringify(data))
  } catch {
    // sessionStorage not available
  }
}

function clearDraft(animalId: string) {
  try {
    sessionStorage.removeItem(DRAFT_KEY(animalId))
  } catch {
    // noop
  }
}

export function useAdoptionForm(animal: Animal) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)

  const draft = loadDraft(animal.id)

  const form = useForm<AdoptionFormData>({
    // Cast needed: z.coerce.number() in Zod v4 infers output as `unknown` in the resolver type
    resolver: zodResolver(createAdoptionSchema(animal.species)) as unknown as Resolver<AdoptionFormData>,
    defaultValues: {
      fullName: '',
      email: '',
      birthDate: '',
      phone: '',
      address: {
        street: '',
        number: '',
        complement: '',
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
      ...draft,
    },
    mode: 'onTouched',
  })

  const goNext = useCallback(async () => {
    const values = form.getValues()
    const fields = getStepFields(currentStep, animal.species, values)
    const valid = await form.trigger(fields as Parameters<typeof form.trigger>[0])
    if (!valid) return

    saveDraft(animal.id, form.getValues())
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }, [currentStep, animal.species, animal.id, form])

  const goBack = useCallback(() => {
    saveDraft(animal.id, form.getValues())
    setCurrentStep((s) => Math.max(s - 1, 1))
  }, [animal.id, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const id = await createApplication(
        animal.id,
        animal.name,
        animal.species,
        data,
      )
      clearDraft(animal.id)
      setApplicationId(id)
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
    currentStep,
    totalSteps: TOTAL_STEPS,
    isLastStep: currentStep === TOTAL_STEPS,
    goNext,
    goBack,
    handleSubmit,
    isSubmitting,
    submitError,
    applicationId,
    isSuccess: applicationId !== null,
  }
}
