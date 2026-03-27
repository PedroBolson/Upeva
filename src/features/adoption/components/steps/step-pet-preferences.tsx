import { Controller, useFormContext } from 'react-hook-form'
import { RadioGroup } from '@/components/ui/radio-group'
import type { Species } from '@/types/common'
import { YES_NO_OPTIONS } from '../../config/form-config'
import type { AdoptionFormData } from '../../types/adoption.types'

const SEX_OPTIONS = [
  { value: 'male', label: 'Macho' },
  { value: 'female', label: 'Fêmea' },
  { value: 'any', label: 'Sem preferência' },
]

const SIZE_OPTIONS = [
  { value: 'small', label: 'Pequeno' },
  { value: 'medium', label: 'Médio' },
  { value: 'large', label: 'Grande' },
  { value: 'any', label: 'Sem preferência' },
]

interface Props {
  species: Species
}

export function StepPetPreferences({ species }: Props) {
  const {
    control,
    formState: { errors },
  } = useFormContext<AdoptionFormData>()

  if (species === 'dog') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Preferências para o animal
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Essas preferências nos ajudam a encontrar o melhor encaixe para você.
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4">
          <Controller
            name="preferredSex"
            control={control}
            render={({ field }) => (
              <RadioGroup
                name="preferredSex"
                label="Sexo preferido"
                options={SEX_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.preferredSex?.message}
                orientation="horizontal"
              />
            )}
          />

          <div className="border-t border-border" />

          <Controller
            name="preferredSize"
            control={control}
            render={({ field }) => (
              <RadioGroup
                name="preferredSize"
                label="Porte preferido"
                options={SIZE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.preferredSize?.message}
                orientation="horizontal"
              />
            )}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Sobre a adoção
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Algumas informações sobre como será essa adoção.
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4">
        <Controller
          name="preferredSex"
          control={control}
          render={({ field }) => (
            <RadioGroup
              name="preferredSex"
              label="Sexo preferido"
              options={SEX_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.preferredSex?.message}
              orientation="horizontal"
            />
          )}
        />

        <div className="border-t border-border" />

        <Controller
          name="jointAdoption"
          control={control}
          render={({ field }) => (
            <RadioGroup
              name="jointAdoption"
              label="Você gostaria de adotar dois gatos juntos?"
              options={YES_NO_OPTIONS}
              value={field.value === undefined ? '' : String(field.value)}
              onChange={(v) => field.onChange(v === 'true')}
              error={errors.jointAdoption?.message}
              hint="Gatos se adaptam melhor em duplas, especialmente filhotes."
            />
          )}
        />
      </div>
    </div>
  )
}
