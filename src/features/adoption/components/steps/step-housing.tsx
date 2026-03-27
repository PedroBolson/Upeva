import { AnimatePresence, motion } from 'framer-motion'
import { Controller, useFormContext } from 'react-hook-form'
import { RadioGroup } from '@/components/ui/radio-group'
import type { Species } from '@/types/common'
import { YES_NO_OPTIONS } from '../../config/form-config'
import type { AdoptionFormData } from '../../types/adoption.types'

const HOUSING_OPTIONS_DOG = [
  { value: 'house_open_yard', label: 'Casa com quintal aberto' },
  { value: 'house_closed_yard', label: 'Casa com quintal fechado' },
  { value: 'house_no_yard', label: 'Casa sem quintal' },
  { value: 'apartment_with_screens', label: 'Apartamento com telas de proteção' },
  { value: 'apartment_no_screens', label: 'Apartamento sem telas' },
  { value: 'apartment', label: 'Apartamento' },
]

const HOUSING_OPTIONS_CAT = [
  { value: 'apartment_with_screens', label: 'Apartamento com telas de proteção', description: 'Recomendado' },
  { value: 'house_closed_yard', label: 'Casa com quintal fechado' },
  { value: 'house_open_yard', label: 'Casa com quintal aberto' },
  { value: 'house_no_yard', label: 'Casa sem quintal' },
  { value: 'apartment_no_screens', label: 'Apartamento sem telas', description: 'Atenção: risco de fuga' },
  { value: 'apartment', label: 'Apartamento' },
]

const slideDown = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
}

const slideTransition = { duration: 0.25, ease: 'easeInOut' as const }

interface Props {
  species: Species
}

export function StepHousing({ species }: Props) {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<AdoptionFormData>()

  const isRented = watch('isRented')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Sua moradia</h2>
        <p className="text-sm text-muted-foreground mt-1">
          O ambiente influencia muito o bem-estar do animal.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <Controller
          name="housingType"
          control={control}
          render={({ field }) => (
            <RadioGroup
              name="housingType"
              label="Tipo de moradia"
              options={species === 'cat' ? HOUSING_OPTIONS_CAT : HOUSING_OPTIONS_DOG}
              value={field.value}
              onChange={field.onChange}
              error={errors.housingType?.message}
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <Controller
          name="isRented"
          control={control}
          render={({ field }) => (
            <RadioGroup
              name="isRented"
              label="O imóvel é alugado?"
              options={YES_NO_OPTIONS}
              value={field.value === undefined ? '' : String(field.value)}
              onChange={(v) => field.onChange(v === 'true')}
              error={errors.isRented?.message}
              orientation="horizontal"
            />
          )}
        />

        <AnimatePresence initial={false}>
          {isRented === true && (
            <motion.div {...slideDown} transition={slideTransition} style={{ overflow: 'hidden' }}>
              <div className="border-t border-border pt-4">
                <Controller
                  name="landlordAllowsPets"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      name="landlordAllowsPets"
                      label="O proprietário permite animais de estimação?"
                      options={YES_NO_OPTIONS}
                      value={field.value === undefined ? '' : String(field.value)}
                      onChange={(v) => field.onChange(v === 'true')}
                      error={errors.landlordAllowsPets?.message}
                      hint="É necessário ter autorização para garantir que o animal não precise ser devolvido."
                      orientation="horizontal"
                    />
                  )}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
