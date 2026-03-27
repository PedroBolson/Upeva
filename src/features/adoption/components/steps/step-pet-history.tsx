import { AnimatePresence, motion } from 'framer-motion'
import { Controller, useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup } from '@/components/ui/radio-group'
import type { Species } from '@/types/common'
import { YES_NO_OPTIONS } from '../../config/form-config'
import type { AdoptionFormData } from '../../types/adoption.types'

const slideDown = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
}

const slideTransition = { duration: 0.25, ease: 'easeInOut' as const }

interface Props {
  species: Species
}

export function StepPetHistory({ species }: Props) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<AdoptionFormData>()

  const hadPetsBefore = watch('hadPetsBefore')
  const hasCurrentPets = watch('hasCurrentPets')
  const currentPetsVaccinated = watch('currentPetsVaccinated')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Histórico com animais
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Experiência prévia nos ajuda a orientar melhor o processo de adoção.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <Controller
          name="hadPetsBefore"
          control={control}
          render={({ field }) => (
            <RadioGroup
              name="hadPetsBefore"
              label="Já teve animais de estimação antes?"
              options={YES_NO_OPTIONS}
              value={field.value === undefined ? '' : String(field.value)}
              onChange={(v) => field.onChange(v === 'true')}
              error={errors.hadPetsBefore?.message}
              orientation="horizontal"
            />
          )}
        />

        <AnimatePresence initial={false}>
          {hadPetsBefore === true && (
            <motion.div {...slideDown} transition={slideTransition} style={{ overflow: 'hidden' }}>
              <div className="border-t border-border pt-4">
                <Textarea
                  label="Conte sobre os animais que já teve"
                  placeholder="Espécie, nome, o que aconteceu com eles..."
                  error={errors.previousPets?.message}
                  required
                  {...register('previousPets')}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <Controller
          name="hasCurrentPets"
          control={control}
          render={({ field }) => (
            <RadioGroup
              name="hasCurrentPets"
              label="Você tem animais atualmente?"
              options={YES_NO_OPTIONS}
              value={field.value === undefined ? '' : String(field.value)}
              onChange={(v) => field.onChange(v === 'true')}
              error={errors.hasCurrentPets?.message}
              orientation="horizontal"
            />
          )}
        />

        <AnimatePresence initial={false}>
          {hasCurrentPets === true && (
            <motion.div {...slideDown} transition={slideTransition} style={{ overflow: 'hidden' }}>
              <div className="flex flex-col gap-4 border-t border-border pt-4">
                <Input
                  label="Quantos animais você tem?"
                  type="number"
                  min={1}
                  error={errors.currentPetsCount?.message}
                  required
                  {...register('currentPetsCount')}
                />

                {species === 'cat' && (
                  <Controller
                    name="currentPetsVaccinated"
                    control={control}
                    render={({ field }) => (
                      <RadioGroup
                        name="currentPetsVaccinated"
                        label="Seus animais atuais são vacinados?"
                        options={YES_NO_OPTIONS}
                        value={field.value === undefined ? '' : String(field.value)}
                        onChange={(v) => field.onChange(v === 'true')}
                        error={errors.currentPetsVaccinated?.message}
                        orientation="horizontal"
                      />
                    )}
                  />
                )}

                <AnimatePresence initial={false}>
                  {species === 'cat' && currentPetsVaccinated === false && (
                    <motion.div {...slideDown} transition={slideTransition} style={{ overflow: 'hidden' }}>
                      <Textarea
                        label="Por que seus animais não são vacinados?"
                        placeholder="Explique o motivo..."
                        error={errors.currentPetsVaccinationReason?.message}
                        required
                        {...register('currentPetsVaccinationReason')}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
