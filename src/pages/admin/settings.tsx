import { useMemo, useState } from 'react'
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { Input, Button } from '@/components/ui'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { Loader2 } from 'lucide-react'

export function SettingsPage() {
  const { user } = useAuth()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMessage, setNameMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passMessage, setPassMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [passError, setPassError] = useState<string | null>(null)

  const headerConfig = useMemo(
    () => ({}),
    [],
  )

  useAdminPageHeader(headerConfig)

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !displayName.trim()) return
    setNameLoading(true)
    setNameMessage(null)
    try {
      await updateProfile(user, { displayName: displayName.trim() })
      setNameMessage({ text: 'Nome atualizado com sucesso.', ok: true })
    } catch {
      setNameMessage({ text: 'Não foi possível atualizar o nome.', ok: false })
    } finally {
      setNameLoading(false)
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPassMessage(null)
    setPassError(null)

    if (newPassword.length < 6) {
      setPassError('A nova senha deve ter ao menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPassError('As senhas não coincidem.')
      return
    }
    if (!user?.email) return

    setPassLoading(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      setPassMessage({ text: 'Senha atualizada com sucesso.', ok: true })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('wrong-password')
          ? 'Senha atual incorreta.'
          : 'Não foi possível atualizar a senha.'
      setPassMessage({ text: msg, ok: false })
    } finally {
      setPassLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">
        {user?.email}
      </p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Display name */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">Nome de exibição</h2>
          <form onSubmit={handleUpdateName} className="flex flex-col gap-4">
            <Input
              label="Nome"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            {nameMessage && (
              <p className={`text-sm ${nameMessage.ok ? 'text-success' : 'text-danger'}`}>
                {nameMessage.text}
              </p>
            )}
            <Button type="submit" disabled={nameLoading} className="w-full gap-1.5 sm:w-auto sm:self-start">
              {nameLoading && <Loader2 size={14} className="animate-spin" />}
              {nameLoading ? 'Salvando…' : 'Salvar nome'}
            </Button>
          </form>
        </div>

        {/* Password */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">Alterar senha</h2>
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
            <Input
              label="Senha atual"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {passError && <p className="text-sm text-danger">{passError}</p>}
            {passMessage && (
              <p className={`text-sm ${passMessage.ok ? 'text-success' : 'text-danger'}`}>
                {passMessage.text}
              </p>
            )}
            <Button type="submit" disabled={passLoading} className="w-full gap-1.5 sm:w-auto sm:self-start">
              {passLoading && <Loader2 size={14} className="animate-spin" />}
              {passLoading ? 'Atualizando…' : 'Alterar senha'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
