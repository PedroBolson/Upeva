import { Controller, useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup } from '@/components/ui/radio-group'
import type { Species } from '@/types/common'
import { YES_NO_OPTIONS } from '../../config/form-config'
import type { AdoptionFormData } from '../../types/adoption.types'

interface Props {
  species: Species
}

export function StepLifestyle({ species }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<AdoptionFormData>()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Seu estilo de vida
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Queremos entender sua rotina para garantir um bom encaixe com o animal.
        </p>
      </div>

      <Textarea
        label="Por que você quer adotar?"
        placeholder="Conte um pouco sobre sua motivação e o que espera da convivência com o animal..."
        error={errors.adoptionReason?.message}
        required
        {...register('adoptionReason')}
      />

      <Input
        label="Quantas horas por dia alguém fica em casa?"
        type="number"
        min={0}
        max={24}
        error={errors.hoursHomePeoplePerDay?.message}
        hint="Considere a soma de todos os moradores."
        required
        {...register('hoursHomePeoplePerDay')}
      />

      {species === 'cat' && (
        <Controller
          name="isGift"
          control={control}
          render={({ field }) => (
            <RadioGroup
              name="isGift"
              label="Esta adoção é um presente para outra pessoa?"
              options={YES_NO_OPTIONS}
              value={field.value === undefined ? '' : String(field.value)}
              onChange={(v) => field.onChange(v === 'true')}
              error={errors.isGift?.message}
              hint="Adoções como presente não são recomendadas. Caso sim, entraremos em contato."
            />
          )}
        />
      )}
    </div>
  )
}
