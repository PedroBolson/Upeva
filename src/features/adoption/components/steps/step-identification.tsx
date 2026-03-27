import { useState, useEffect } from 'react'
import { Clock, Lock } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui'
import { MaskedInput } from '@/components/ui/masked-input'
import { DatePicker } from '@/components/ui/date-picker'
import { CepInput, type ViaCepAddress } from '@/components/ui/cep-input'
import type { AdoptionFormData } from '../../types/adoption.types'

type LockedFields = { street: boolean; city: boolean; state: boolean }

export function StepIdentification() {
  const {
    register,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<AdoptionFormData>()

  const [lockedFields, setLockedFields] = useState<LockedFields>({
    street: false,
    city: false,
    state: false,
  })

  // Restore lock state on mount (e.g. when navigating back to this step)
  useEffect(() => {
    const values = getValues()
    const cepDigits = (values.cep ?? '').replace(/\D/g, '')
    if (cepDigits.length === 8) {
      setLockedFields({
        street: Boolean(values.address?.street?.trim()),
        city: Boolean(values.address?.city?.trim()),
        state: Boolean(values.address?.state?.trim()),
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAddressFound({ street, city, state }: ViaCepAddress) {
    const locks: LockedFields = { street: false, city: false, state: false }
    if (street) {
      setValue('address.street', street, { shouldDirty: true })
      locks.street = true
    }
    if (city) {
      setValue('address.city', city, { shouldDirty: true })
      locks.city = true
    }
    if (state) {
      setValue('address.state', state, { shouldDirty: true })
      locks.state = true
    }
    setLockedFields(locks)
  }

  const lockIcon = <Lock size={13} className="text-muted-foreground" />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Seus dados pessoais
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Clock size={11} />
            ~5 minutos
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Precisamos dessas informações para entrar em contato com você.
        </p>
      </div>

      {/* Dados pessoais */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Nome completo"
              error={errors.fullName?.message}
              required
              {...register('fullName')}
            />
          </div>

          <Controller
            name="cpf"
            control={control}
            render={({ field }) => (
              <MaskedInput
                mask="cpf"
                label="CPF"
                placeholder="000.000.000-00"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.cpf?.message}
                required
              />
            )}
          />

          <Controller
            name="birthDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Data de nascimento"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.birthDate?.message}
                required
              />
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="E-mail"
            type="email"
            error={errors.email?.message}
            required
            {...register('email')}
          />

          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <MaskedInput
                mask="phone"
                label="Telefone / WhatsApp"
                placeholder="(00) 00000-0000"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.phone?.message}
                required
              />
            )}
          />
        </div>
      </div>

      {/* Endereço */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Endereço</h3>

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <div className="sm:col-span-2">
            <Controller
              name="cep"
              control={control}
              render={({ field }) => (
                <CepInput
                  label="CEP"
                  value={field.value ?? ''}
                  onChange={(masked) => {
                    field.onChange(masked)
                    if (masked.replace(/\D/g, '').length < 8) {
                      setLockedFields({ street: false, city: false, state: false })
                    }
                  }}
                  onBlur={field.onBlur}
                  onAddressFound={handleAddressFound}
                  required
                />
              )}
            />
          </div>

          <div className="sm:col-span-4">
            <Input
              label="Rua / Avenida"
              placeholder="Preenchido pelo CEP"
              error={errors.address?.street?.message}
              readOnly={lockedFields.street}
              rightIcon={lockedFields.street ? lockIcon : undefined}
              required
              {...register('address.street')}
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              label="Número"
              error={errors.address?.number?.message}
              required
              {...register('address.number')}
            />
          </div>

          <div className="sm:col-span-4">
            <Input
              label="Complemento"
              placeholder="Apto, bloco… (opcional)"
              {...register('address.complement')}
            />
          </div>

          <div className="sm:col-span-4">
            <Input
              label="Cidade"
              placeholder="Preenchida pelo CEP"
              error={errors.address?.city?.message}
              readOnly={lockedFields.city}
              rightIcon={lockedFields.city ? lockIcon : undefined}
              required
              {...register('address.city')}
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              label="Estado (UF)"
              placeholder="SP"
              maxLength={2}
              error={errors.address?.state?.message}
              readOnly={lockedFields.state}
              rightIcon={lockedFields.state ? lockIcon : undefined}
              required
              {...register('address.state')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
