import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/utils/cn'
import type { ArchiveReason } from '@/types/common'

const ARCHIVE_REASON_OPTIONS: Array<{ value: ArchiveReason; label: string }> = [
  { value: 'death', label: 'Falecimento' },
  { value: 'serious_illness', label: 'Doença grave' },
  { value: 'transfer', label: 'Transferência para outro lar/ONG' },
  { value: 'other', label: 'Outro' },
]

const MIN_DETAILS_LENGTH = 20

interface ArchiveAnimalModalProps {
  open: boolean
  animalName: string
  onClose: () => void
  onConfirm: (reason: ArchiveReason, details: string, archiveDate: string) => void
  loading: boolean
}

export function ArchiveAnimalModal({
  open,
  animalName,
  onClose,
  onConfirm,
  loading,
}: ArchiveAnimalModalProps) {
  const [reason, setReason] = useState<ArchiveReason | ''>('')
  const [details, setDetails] = useState('')
  const [archiveDate, setArchiveDate] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleClose() {
    if (loading) return
    setReason('')
    setDetails('')
    setArchiveDate('')
    setValidationError(null)
    onClose()
  }

  function handleSubmit() {
    if (!reason) {
      setValidationError('Selecione o motivo do arquivamento.')
      return
    }
    if (details.trim().length < MIN_DETAILS_LENGTH) {
      setValidationError(`Os detalhes devem ter no mínimo ${MIN_DETAILS_LENGTH} caracteres (atual: ${details.trim().length}).`)
      return
    }
    if (!archiveDate) {
      setValidationError('Informe a data em que o ocorrido aconteceu.')
      return
    }
    setValidationError(null)
    onConfirm(reason, details.trim(), archiveDate)
  }

  const detailsCount = details.trim().length
  const detailsValid = detailsCount >= MIN_DETAILS_LENGTH

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Arquivar ${animalName}`}
      size="md"
      closeOnOverlay={!loading}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Arquivar animal
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          O arquivamento é permanente. Informe o motivo e a data do ocorrido para o histórico da ONG.
          O PDF de arquivamento será gerado e salvo no Drive no próximo ciclo semanal.
        </p>

        <Select
          label="Motivo"
          options={ARCHIVE_REASON_OPTIONS}
          value={reason || undefined}
          onChange={(v) => setReason(v as ArchiveReason)}
          placeholder="Selecione um motivo"
        />

        <div className="flex flex-col gap-1">
          <Textarea
            label="Detalhes"
            placeholder="Descreva o que aconteceu com detalhes suficientes para o histórico…"
            rows={4}
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

        <DatePicker
          label="Data do ocorrido"
          value={archiveDate}
          onChange={(v) => setArchiveDate(v)}
        />

        {validationError && (
          <p role="alert" className="text-sm text-danger">{validationError}</p>
        )}
      </div>
    </Modal>
  )
}
