import { useState } from 'react'
import { Info, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/utils/cn'
import type { RejectionReason } from '@/types/common'

const REJECTION_REASON_OPTIONS: Array<{ value: RejectionReason; label: string }> = [
  { value: 'inadequate_housing',        label: 'Moradia inadequada' },
  { value: 'no_landlord_permission',    label: 'Sem autorização do proprietário' },
  { value: 'financial_instability',     label: 'Instabilidade financeira' },
  { value: 'previous_animal_negligence', label: 'Histórico de negligência com animais' },
  { value: 'incompatible_lifestyle',    label: 'Estilo de vida incompatível' },
  { value: 'other',                     label: 'Outro' },
]

const MIN_DETAILS_LENGTH = 100

type Step = 'choose' | 'reject-form'

interface RejectionModalProps {
  open: boolean
  onClose: () => void
  onDecline: () => void
  onReject: (reason: RejectionReason, details: string) => void
  loading: boolean
}

export function RejectionModal({ open, onClose, onDecline, onReject, loading }: RejectionModalProps) {
  const [step, setStep] = useState<Step>('choose')
  const [reason, setReason] = useState<RejectionReason | ''>('')
  const [details, setDetails] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleClose() {
    if (loading) return
    setStep('choose')
    setReason('')
    setDetails('')
    setConfirmed(false)
    setValidationError(null)
    onClose()
  }

  function handleSubmitReject() {
    if (!reason) {
      setValidationError('Selecione um motivo principal.')
      return
    }
    if (details.trim().length < MIN_DETAILS_LENGTH) {
      setValidationError(`A descrição deve ter no mínimo ${MIN_DETAILS_LENGTH} caracteres (atual: ${details.trim().length}).`)
      return
    }
    if (!confirmed) {
      setValidationError('Confirme que o registro é definitivo antes de prosseguir.')
      return
    }
    setValidationError(null)
    onReject(reason, details.trim())
  }

  const detailsCount = details.trim().length
  const detailsValid = detailsCount >= MIN_DETAILS_LENGTH

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Recusar candidatura"
      size="md"
      closeOnOverlay={!loading}
      footer={
        step === 'reject-form' ? (
          <>
            <Button variant="ghost" onClick={() => setStep('choose')} disabled={loading}>
              Voltar
            </Button>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleSubmitReject} disabled={loading}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              Confirmar rejeição
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="mb-5 rounded-lg border border-border bg-muted/50 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-foreground mb-2">
          <Info size={14} className="shrink-0 text-muted-foreground" />
          Qual tipo de recusa?
        </p>
        <p className="text-muted-foreground">
          <strong className="text-foreground">Declinar</strong> — recusa simples sem registro permanente.
          Indicado para perfis incompletos, duplicatas ou desistências.
        </p>
        <p className="mt-1 text-muted-foreground">
          <strong className="text-foreground">Rejeitar definitivamente</strong> — gera um registro de alerta
          permanente para a equipe com o motivo documentado. A candidatura será arquivada no Drive.
        </p>
      </div>

      {step === 'choose' && (
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onDecline}
            disabled={loading}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Apenas declinar
          </Button>
          <Button
            variant="danger"
            className="w-full justify-start"
            onClick={() => setStep('reject-form')}
            disabled={loading}
          >
            Rejeitar definitivamente →
          </Button>
        </div>
      )}

      {step === 'reject-form' && (
        <div className="flex flex-col gap-4">
          <Select
            label="Motivo principal"
            options={REJECTION_REASON_OPTIONS}
            value={reason || undefined}
            onChange={(v) => setReason(v as RejectionReason)}
            placeholder="Selecione um motivo"
          />

          <div className="flex flex-col gap-1">
            <Textarea
              label="Descrição detalhada"
              placeholder="Descreva com detalhes suficientes para embasar a decisão…"
              rows={5}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            <p className={cn(
              'text-xs self-end tabular-nums',
              detailsValid ? 'text-success' : 'text-muted-foreground',
            )}>
              {detailsCount}/{MIN_DETAILS_LENGTH} caracteres mínimos
            </p>
          </div>

          <Checkbox
            label="Confirmo que este registro é permanente e será arquivado no histórico da ONG"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />

          {validationError && (
            <p role="alert" className="text-sm text-danger">{validationError}</p>
          )}
        </div>
      )}
    </Modal>
  )
}
