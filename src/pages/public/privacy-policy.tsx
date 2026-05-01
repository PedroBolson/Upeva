import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Lock, Eye, Trash2, Mail, UserCheck } from 'lucide-react'
import { fadeUp, stagger } from '@/utils/animations'
import { buildPublicTitle, useDocumentTitle } from '@/utils/page-title'
import { APPROVED_RETENTION_DAYS, ARCHIVED_ANIMAL_RETENTION_DAYS } from '@/types/common'

const DPO_EMAIL = 'upeva.adocoes@gmail.com'
const DPO_RESPONSE_DAYS = 15

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.section variants={fadeUp} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon size={16} className="text-primary" />
        </div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="ml-10 flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </motion.section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="shrink-0 font-medium text-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function PrivacyPolicyPage() {
  useDocumentTitle(buildPublicTitle('Política de Privacidade'))

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-20 pb-16 sm:pt-28">
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-8">

        <motion.div variants={fadeUp} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Shield size={22} className="text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Política de Privacidade</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Última atualização: maio de 2026 · Em conformidade com a LGPD (Lei 13.709/2018)
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            A Upeva respeita sua privacidade. Este documento explica quais dados coletamos,
            por que, por quanto tempo e quais são seus direitos como titular.
          </p>
        </motion.div>

        <Section title="Quem somos" icon={UserCheck}>
          <Row label="Controlador:" value="Upeva — União Pela Vida Animal" />
          <Row label="Encarregado (DPO):" value="Coordenação do projeto — contato abaixo" />
          <Row label="E-mail:" value={<a href={`mailto:${DPO_EMAIL}`} className="text-primary hover:underline">{DPO_EMAIL}</a>} />
        </Section>

        <Section title="Dados coletados" icon={Eye}>
          <p>Ao preencher o formulário de candidatura à adoção, coletamos:</p>
          <ul className="list-disc list-inside flex flex-col gap-1">
            <li><strong className="text-foreground">Nome completo e e-mail</strong> — identificação e comunicação (armazenados em texto legível)</li>
            <li><strong className="text-foreground">CPF, telefone, endereço e data de nascimento</strong> — triagem de perfil (armazenados cifrados com AES-256-GCM; apenas a equipe da ONG pode acessar)</li>
            <li><strong className="text-foreground">Respostas do formulário</strong> — perfil de lar, histórico com animais, condições de moradia</li>
          </ul>
          <p>
            Não coletamos dados de pagamento, redes sociais ou localização em tempo real.
          </p>
        </Section>

        <Section title="Finalidades e base legal" icon={Lock}>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-1">
              <p className="font-medium text-foreground">1. Processamento da candidatura à adoção</p>
              <p>Avaliar se o perfil do candidato é adequado para o animal. Base legal: consentimento (LGPD Art. 7, I).</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-1">
              <p className="font-medium text-foreground">2. Segurança histórica e prevenção de fraudes</p>
              <p>
                Candidaturas com rejeição definitiva geram um registro anônimo (apenas hash do CPF e e-mail — sem dados pessoais legíveis)
                para proteger futuros animais. Base legal: legítimo interesse (LGPD Art. 7, IX).
              </p>
            </div>
          </div>
        </Section>

        <Section title="Retenção e exclusão" icon={Trash2}>
          <p>Seguimos o princípio de minimização de dados: nenhum dado pessoal fica além do necessário.</p>
          <ul className="list-disc list-inside flex flex-col gap-1">
            <li><strong className="text-foreground">Candidatura aprovada:</strong> {APPROVED_RETENTION_DAYS} dias após aprovação → exportada como PDF para armazenamento interno → excluída do banco de dados</li>
            <li><strong className="text-foreground">Candidatura com rejeição definitiva:</strong> exportada como PDF → excluída do banco; resta apenas um registro anônimo sem PII</li>
            <li><strong className="text-foreground">Candidatura recusada ou desistência:</strong> excluída sem geração de PDF ou registro</li>
            <li><strong className="text-foreground">Animal arquivado:</strong> {ARCHIVED_ANIMAL_RETENTION_DAYS} dias após arquivamento → exportado como PDF → excluído do banco</li>
          </ul>
        </Section>

        <Section title="Seus direitos (LGPD Art. 18)" icon={Mail}>
          <p>Você pode, a qualquer momento, solicitar:</p>
          <ul className="list-disc list-inside flex flex-col gap-1">
            <li>Confirmação de que seus dados estão sendo tratados</li>
            <li>Acesso aos dados que armazenamos sobre você</li>
            <li>Correção de dados incompletos ou desatualizados</li>
            <li>Exclusão dos dados (direito ao esquecimento)</li>
            <li>Portabilidade dos dados a outro controlador</li>
            <li>Revogação do consentimento</li>
          </ul>
          <p className="mt-1">
            Envie sua solicitação para{' '}
            <a href={`mailto:${DPO_EMAIL}`} className="text-primary hover:underline">{DPO_EMAIL}</a>{' '}
            com o assunto <strong className="text-foreground">"LGPD — Direitos do Titular"</strong>.
            Respondemos em até <strong className="text-foreground">{DPO_RESPONSE_DAYS} dias úteis</strong>.
          </p>
        </Section>

        <motion.div variants={fadeUp} className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Esta política pode ser atualizada conforme evoluímos o sistema. Mudanças relevantes serão
          comunicadas antes de entrarem em vigor. Dúvidas?{' '}
          <a href={`mailto:${DPO_EMAIL}`} className="text-primary hover:underline">Entre em contato</a>.
        </motion.div>

        <motion.div variants={fadeUp}>
          <Link to="/animais" className="text-sm text-primary hover:underline">
            ← Voltar para os animais
          </Link>
        </motion.div>

      </motion.div>
    </div>
  )
}
