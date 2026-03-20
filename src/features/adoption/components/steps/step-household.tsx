import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui'
import type { AdoptionFormData } from '../../types/adoption.types'

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
        <h2 className="text-lg font-semibold text-foreground">
          Sua família
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Queremos entender o ambiente em que o animal vai viver.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Quantos adultos moram na casa?"
          type="number"
          min={1}
          error={errors.adultsCount?.message}
          required
          {...register('adultsCount')}
        />

        <Input
          label="Quantas crianças moram na casa?"
          type="number"
          min={0}
          error={errors.childrenCount?.message}
          required
          {...register('childrenCount')}
        />
      </div>

      {Number(childrenCount) > 0 && (
        <Input
          label="Idades das crianças"
          placeholder="Ex: 3, 7, 12"
          hint="Separe as idades por vírgula."
          error={errors.childrenAges?.message}
          required
          {...register('childrenAges')}
        />
      )}
    </div>
  )
}
