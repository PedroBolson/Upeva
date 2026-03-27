import { AnimatePresence, motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui'
import type { AdoptionFormData } from '../../types/adoption.types'

const slideDown = {
  initial: { opacity: 0, height: 0, marginTop: 0 },
  animate: { opacity: 1, height: 'auto', marginTop: 0 },
  exit: { opacity: 0, height: 0, marginTop: 0 },
}

const slideTransition = { duration: 0.25, ease: 'easeInOut' as const }

export function StepHousehold() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<AdoptionFormData>()

  const childrenCount = watch('childrenCount')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">Sua família</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Users size={11} />
            Composição do lar
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Queremos entender o ambiente em que o animal vai viver.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Adultos morando na casa"
            type="number"
            min={1}
            error={errors.adultsCount?.message}
            required
            {...register('adultsCount')}
          />

          <Input
            label="Crianças morando na casa"
            type="number"
            min={0}
            error={errors.childrenCount?.message}
            required
            {...register('childrenCount')}
          />
        </div>

        <AnimatePresence initial={false}>
          {Number(childrenCount) > 0 && (
            <motion.div {...slideDown} transition={slideTransition} style={{ overflow: 'hidden' }}>
              <Input
                label="Idades das crianças"
                placeholder="Ex: 3, 7, 12"
                hint="Separe as idades por vírgula."
                error={errors.childrenAges?.message}
                required
                {...register('childrenAges')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
