import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PawPrint } from 'lucide-react'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { SystemBarTint } from '@/components/ui/system-bar-tint'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { buildAdminTitle, useDocumentTitle } from '@/utils/page-title'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

const resetSchema = z.object({
  email: z.string().email('Email inválido'),
})

type LoginForm = z.infer<typeof loginSchema>
type ResetForm = z.infer<typeof resetSchema>

export function LoginPage() {
  const { user, login, signingIn, error, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/admin'

  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)

  useDocumentTitle(buildAdminTitle(mode === 'login' ? 'Entrar' : 'Recuperar senha'))

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, from, navigate])

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) })

  async function onLogin(data: LoginForm) {
    await login(data.email, data.password)
  }

  async function onReset(data: ResetForm) {
    setResetLoading(true)
    setResetError(null)
    try {
      await sendPasswordReset(data.email)
      setResetSent(true)
    } catch {
      setResetError('Não foi possível enviar o email. Verifique o endereço e tente novamente.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SystemBarTint tone="background" className="bg-background" />
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
            {mode === 'login' ? 'Entre para acessar o painel' : 'Recuperar senha'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              required
              error={loginForm.formState.errors.email?.message}
              {...loginForm.register('email')}
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              error={loginForm.formState.errors.password?.message}
              {...loginForm.register('password')}
            />

            {error && (
              <p role="alert" className="text-sm text-danger text-center">
                {error}
              </p>
            )}

            <Button type="submit" loading={signingIn} className="mt-2 w-full">
              Entrar
            </Button>

            <button
              type="button"
              onClick={() => setMode('reset')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              Esqueci minha senha
            </button>
          </form>
        ) : (
          <form onSubmit={resetForm.handleSubmit(onReset)} noValidate className="flex flex-col gap-4">
            {resetSent ? (
              <div className="rounded-lg bg-success/10 border border-success/20 p-4 text-sm text-success text-center">
                <p>Email enviado! Verifique sua caixa de entrada.</p>
                <p className="mt-1">
                  Caso não encontre, confira a pasta de spam ou tente novamente. O link para redefinir sua senha é válido por 1 hora.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Informe seu email e enviaremos um link para redefinir sua senha.
                </p>
                <Input
                  label="Email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                  error={resetForm.formState.errors.email?.message}
                  {...resetForm.register('email')}
                />
                {resetError && (
                  <p role="alert" className="text-sm text-danger">
                    {resetError}
                  </p>
                )}
                <Button type="submit" loading={resetLoading} className="w-full">
                  Enviar link
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => { setMode('login'); setResetSent(false); setResetError(null) }}
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
