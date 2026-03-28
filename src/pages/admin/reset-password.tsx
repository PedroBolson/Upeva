import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PawPrint } from 'lucide-react'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { confirmReset } from '@/features/auth/services/auth.service'

const schema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm:  z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path: ['confirm'],
  })

type FormData = z.infer<typeof schema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const oobCode = searchParams.get('oobCode') ?? ''

  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      await confirmReset(oobCode, data.password)
      setSuccess(true)
    } catch {
      setServerError('Link inválido ou expirado. Solicite um novo link de redefinição.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="rounded-xl bg-primary/10 p-3">
            <PawPrint className="text-primary" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Upeva Admin</h1>
          <p className="text-sm text-muted-foreground">
            {success ? 'Senha redefinida' : 'Criar nova senha'}
          </p>
        </div>

        {success ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-success/10 border border-success/20 p-4 text-sm text-success text-center">
              Senha redefinida com sucesso!
            </div>
            <Button className="w-full" onClick={() => navigate('/admin/login')}>
              Ir para o login
            </Button>
          </div>
        ) : !oobCode ? (
          <div className="rounded-lg bg-danger/10 border border-danger/20 p-4 text-sm text-danger text-center">
            Link inválido. Solicite um novo link de redefinição de senha.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              label="Nova senha"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirmar senha"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
              error={errors.confirm?.message}
              {...register('confirm')}
            />

            {serverError && (
              <p role="alert" className="text-sm text-danger text-center">
                {serverError}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
              Redefinir senha
            </Button>

            <button
              type="button"
              onClick={() => navigate('/admin/login')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              Voltar ao login
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
