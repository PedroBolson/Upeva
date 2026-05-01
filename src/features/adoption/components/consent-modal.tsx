import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui'

interface Props {
  open: boolean
  onAccept: () => void
}

export function ConsentModal({ open, onAccept }: Props) {
  const [consentProcess, setConsentProcess] = useState(false)
  const [consentHistory, setConsentHistory] = useState(false)

  const canProceed = consentProcess && consentHistory

  return (
    <Modal
      open={open}
      onClose={() => { }}
      closeOnOverlay={false}
      size="md"
      footer={
        <Button onClick={onAccept} disabled={!canProceed} className="w-full sm:w-auto">
          Aceitar e continuar
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Shield size={20} className="text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-foreground">
              Antes de continuar
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Para processar sua candidatura à adoção, precisamos do seu consentimento
              para cada finalidade abaixo, conforme a LGPD (Lei 13.709/2018).
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <Checkbox
              id="consent-process"
              checked={consentProcess}
              onChange={e => setConsentProcess(e.target.checked)}
              label={
                <span>
                  <strong>Tratamento do pedido de adoção</strong> — autorizo o uso dos
                  meus dados pessoais (nome, e-mail, CPF, telefone, endereço e data de nascimento)
                  para análise da minha candidatura pela equipe da Upeva.
                </span>
              }
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <Checkbox
              id="consent-history"
              checked={consentHistory}
              onChange={e => setConsentHistory(e.target.checked)}
              label={
                <span>
                  <strong>Armazenamento histórico para segurança</strong> — estou ciente de que,
                  em caso de rejeição definitiva, um registro anônimo (sem dados pessoais legíveis)
                  será mantido para proteger futuros animais da ONG.
                </span>
              }
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Seus dados são armazenados com criptografia e excluídos após o prazo de retenção.
          Ao continuar, você também aceita os{' '}
          <Link to="/termos-de-uso" target="_blank" className="text-primary hover:underline">
            Termos de Uso
          </Link>
          {' '}e a{' '}
          <Link to="/politica-de-privacidade" target="_blank" className="text-primary hover:underline">
            Política de Privacidade
          </Link>.
        </p>
      </div>
    </Modal>
  )
}
