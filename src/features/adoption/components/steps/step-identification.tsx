import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui'
import type { AdoptionFormData } from '../../types/adoption.types'

export function StepIdentification() {
  const {
    register,
    formState: { errors },
  } = useFormContext<AdoptionFormData>()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Seus dados pessoais
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Precisamos dessas informações para entrar em contato com você.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Input
            label="Nome completo"
            error={errors.fullName?.message}
            required
            {...register('fullName')}
          />
        </div>

        <Input
          label="E-mail"
          type="email"
          error={errors.email?.message}
          required
          {...register('email')}
        />

        <Input
          label="Telefone / WhatsApp"
          type="tel"
          placeholder="(xx) 9xxxx-xxxx"
          error={errors.phone?.message}
          required
          {...register('phone')}
        />

        <Input
          label="Data de nascimento"
          type="date"
          error={errors.birthDate?.message}
          required
          {...register('birthDate')}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Endereço
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <div className="sm:col-span-4">
            <Input
              label="Rua / Avenida"
              error={errors.address?.street?.message}
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
          <div className="sm:col-span-3">
            <Input
              label="Complemento"
              placeholder="Apto, bloco… (opcional)"
              {...register('address.complement')}
            />
          </div>
          <div className="sm:col-span-3">
            <Input
              label="Cidade"
              error={errors.address?.city?.message}
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
              required
              {...register('address.state')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
