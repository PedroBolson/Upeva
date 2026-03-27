import { Controller, useFormContext } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import type { AdoptionFormData } from '../../types/adoption.types'

const TERMS: Array<{
  name: keyof AdoptionFormData
  label: React.ReactNode
}> = [
  {
    name: 'acceptsReturnPolicy',
    label: (
      <>
        Entendo que, se não puder mais ficar com o animal,{' '}
        <strong>devo devolvê-lo à Upeva</strong> — nunca repassá-lo para
        terceiros sem autorização.
      </>
    ),
  },
  {
    name: 'acceptsCastrationPolicy',
    label: (
      <>
        Comprometo-me a <strong>castrar o animal</strong> caso ele ainda não
        seja castrado, dentro do prazo acordado no contrato.
      </>
    ),
  },
  {
    name: 'acceptsFollowUp',
    label: (
      <>
        Aceito receber <strong>visitas e contatos de acompanhamento</strong>{' '}
        da Upeva após a adoção.
      </>
    ),
  },
  {
    name: 'acceptsNoResale',
    label: (
      <>
        Comprometo-me a <strong>não vender, rifar ou negociar</strong> o
        animal sob nenhuma circunstância.
      </>
    ),
  },
  {
    name: 'acceptsLiabilityTerms',
    label: (
      <>
        Estou ciente de que sou o único responsável pelo animal após a
        assinatura do contrato, incluindo danos ou incidentes que ele possa
        causar.
      </>
    ),
  },
  {
    name: 'acceptsResponsibility',
    label: (
      <>
        Confirmo que li e concordo com todos os termos acima e assumo a{' '}
        <strong>responsabilidade total</strong> pelo bem-estar deste animal.
      </>
    ),
  },
]

export function StepAgreements() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<AdoptionFormData>()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Termos e compromissos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Leia com atenção e confirme cada item. Estes termos estarão
          presentes no contrato de adoção.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        {TERMS.map(({ name, label }) => (
          <Controller
            key={name}
            name={name}
            control={control}
            render={({ field }) => (
              <Checkbox
                id={name}
                checked={field.value === true}
                onChange={(e) => field.onChange(e.target.checked)}
                label={label}
                error={
                  errors[name]?.message
                    ? String(errors[name]?.message)
                    : undefined
                }
              />
            )}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <Textarea
          label="Observações adicionais"
          placeholder="Alguma informação extra que queira compartilhar? (opcional)"
          rows={3}
          {...register('comments')}
        />
      </div>
    </div>
  )
}
