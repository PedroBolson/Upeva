import { Controller, useFormContext } from 'react-hook-form'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup } from '@/components/ui/radio-group'
import { YES_NO_OPTIONS } from '../../config/form-config'
import type { AdoptionFormData } from '../../types/adoption.types'

export function StepResponsibility() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<AdoptionFormData>()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Comprometimento
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Adotar é uma responsabilidade para toda a vida do animal.
          Queremos ter certeza que você está preparado.
        </p>
      </div>

      <Controller
        name="canAffordCosts"
        control={control}
        render={({ field }) => (
          <RadioGroup
            name="canAffordCosts"
            label="Você tem condições financeiras de arcar com alimentação, veterinário e imprevistos?"
            options={YES_NO_OPTIONS}
            value={field.value === undefined ? '' : String(field.value)}
            onChange={(v) => field.onChange(v === 'true')}
            error={errors.canAffordCosts?.message}
            hint="Estimativa mínima: R$ 150–300/mês em alimentação + consultas anuais."
            orientation="horizontal"
          />
        )}
      />

      <Textarea
        label="Se o animal arranhar ou morder alguém, o que você fará?"
        placeholder="Descreva como você lidaria com essa situação..."
        error={errors.scratchBehaviorResponse?.message}
        required
        {...register('scratchBehaviorResponse')}
      />

      <Textarea
        label="Se o animal escapar ou se perder, o que você fará?"
        placeholder="Descreva suas ações imediatas..."
        error={errors.escapeResponse?.message}
        required
        {...register('escapeResponse')}
      />

      <Textarea
        label="Se por algum motivo não puder mais ficar com o animal, o que fará?"
        placeholder="Descreva o que aconteceria com o animal nessa situação..."
        error={errors.cannotKeepResponse?.message}
        hint="Lembrando que, pelo contrato, o animal deve ser devolvido à Upeva."
        required
        {...register('cannotKeepResponse')}
      />

      <Controller
        name="longTermCommitment"
        control={control}
        render={({ field }) => (
          <RadioGroup
            name="longTermCommitment"
            label="Você se compromete a cuidar do animal por toda a vida dele (10–15 anos)?"
            options={YES_NO_OPTIONS}
            value={field.value === undefined ? '' : String(field.value)}
            onChange={(v) => field.onChange(v === 'true')}
            error={errors.longTermCommitment?.message}
            orientation="horizontal"
          />
        )}
      />
    </div>
  )
}
