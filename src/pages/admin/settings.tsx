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
import { recalibrateCounts, recalibrateQueuePositions } from '@/features/admin/services/metadata.service'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

export function SettingsPage() {
  const { user, userProfile } = useAuth()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMessage, setNameMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passMessage, setPassMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [passError, setPassError] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const [recalibrating, setRecalibrating] = useState(false)
  const [recalibrateMessage, setRecalibrateMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [recalibratingQueue, setRecalibratingQueue] = useState(false)
  const [recalibrateQueueMessage, setRecalibrateQueueMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const headerConfig = useMemo(
    () => ({}),
    [],
  )

  useAdminPageHeader(headerConfig)

  async function handleRecalibrate() {
    setRecalibrating(true)
    setRecalibrateMessage(null)
    try {
      const counts = await recalibrateCounts()
      queryClient.setQueryData(['metadata', 'counts'], counts)
      setRecalibrateMessage({ text: 'Contadores atualizados com sucesso.', ok: true })
    } catch {
      setRecalibrateMessage({ text: 'Não foi possível recalibrar os contadores.', ok: false })
    } finally {
      setRecalibrating(false)
    }
  }

  async function handleRecalibrateQueue() {
    setRecalibratingQueue(true)
    setRecalibrateQueueMessage(null)
    try {
      const result = await recalibrateQueuePositions()
      setRecalibrateQueueMessage({ text: `${result.updatedCount} candidatura(s) atualizadas.`, ok: true })
    } catch {
      setRecalibrateQueueMessage({ text: 'Não foi possível recalibrar as posições.', ok: false })
    } finally {
      setRecalibratingQueue(false)
    }
  }

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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Display name + email */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">Perfil</h2>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <form onSubmit={handleUpdateName} className="flex flex-col gap-4">
            <Input
              label="Nome de exibição"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            {nameMessage && (
              <p role={nameMessage.ok ? 'status' : 'alert'} className={`text-sm ${nameMessage.ok ? 'text-success' : 'text-danger'}`}>
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
            {passError && <p role="alert" className="text-sm text-danger">{passError}</p>}
            {passMessage && (
              <p role={passMessage.ok ? 'status' : 'alert'} className={`text-sm ${passMessage.ok ? 'text-success' : 'text-danger'}`}>
                {passMessage.text}
              </p>
            )}
            <Button type="submit" disabled={passLoading} className="w-full gap-1.5 sm:w-auto sm:self-start">
              {passLoading && <Loader2 size={14} className="animate-spin" />}
              {passLoading ? 'Atualizando…' : 'Alterar senha'}
            </Button>
          </form>
        </div>

        {/* Admin-only: recalibrate counters */}
        {userProfile?.role === 'admin' && (
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 xl:col-span-2">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-foreground">Manutenção de dados</h2>
              <p className="text-xs text-muted-foreground">
                Use se os contadores ou posições de fila estiverem incorretos. As operações são seguras e podem ser repetidas.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-2">
                {recalibrateMessage && (
                  <p role={recalibrateMessage.ok ? 'status' : 'alert'} className={`text-sm ${recalibrateMessage.ok ? 'text-success' : 'text-danger'}`}>
                    {recalibrateMessage.text}
                  </p>
                )}
                <Button
                  variant="outline"
                  onClick={handleRecalibrate}
                  disabled={recalibrating}
                  className="gap-1.5"
                >
                  {recalibrating && <Loader2 size={14} className="animate-spin" />}
                  {recalibrating ? 'Recalibrando…' : 'Recalibrar contadores do dashboard'}
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {recalibrateQueueMessage && (
                  <p role={recalibrateQueueMessage.ok ? 'status' : 'alert'} className={`text-sm ${recalibrateQueueMessage.ok ? 'text-success' : 'text-danger'}`}>
                    {recalibrateQueueMessage.text}
                  </p>
                )}
                <Button
                  variant="outline"
                  onClick={handleRecalibrateQueue}
                  disabled={recalibratingQueue}
                  className="gap-1.5"
                >
                  {recalibratingQueue && <Loader2 size={14} className="animate-spin" />}
                  {recalibratingQueue ? 'Recalibrando…' : 'Recalibrar posições de fila'}
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

