import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, AlertCircle, ShieldCheck, Scale, Mail } from 'lucide-react'
import { fadeUp, stagger } from '@/utils/animations'
import { buildPublicTitle, useDocumentTitle } from '@/utils/page-title'

const DPO_EMAIL = 'upeva.adocoes@gmail.com'

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

export function TermsOfUsePage() {
  useDocumentTitle(buildPublicTitle('Termos de Uso'))

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-20 pb-16 sm:pt-28">
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-8">

        <motion.div variants={fadeUp} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <FileText size={22} className="text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Termos de Uso</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Última atualização: maio de 2026
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            Ao utilizar a plataforma da Upeva, você concorda com os termos descritos abaixo.
            Leia com atenção antes de preencher o formulário de candidatura.
          </p>
        </motion.div>

        <Section title="Finalidade da plataforma" icon={ShieldCheck}>
          <p>
            Esta plataforma tem como único objetivo facilitar o processo de adoção responsável de animais
            resgatados pela Upeva. O uso da plataforma por terceiros para fins comerciais —
            incluindo venda, rifa ou intermediação de animais — é expressamente proibido.
            Atividades de arrecadação promovidas pela própria Upeva ocorrem por canais próprios e não
            estão sujeitas a esta restrição.
          </p>
          <p>
            O envio de uma candidatura não garante a aprovação da adoção. A Upeva reserva-se o direito
            de recusar candidaturas sem obrigação de justificativa detalhada, sempre com base no
            bem-estar animal.
          </p>
        </Section>

        <Section title="Responsabilidades do candidato" icon={AlertCircle}>
          <p>Ao preencher o formulário de candidatura, você declara e se compromete a:</p>
          <ul className="list-disc list-inside flex flex-col gap-1">
            <li>Fornecer informações <strong className="text-foreground">verdadeiras, completas e atualizadas</strong> — informações falsas resultam em cancelamento imediato da candidatura e possibilidade de flag para futuras solicitações</li>
            <li>Não <strong className="text-foreground">vender, rifar, trocar ou repassar</strong> o animal adotado a terceiros sem autorização expressa da Upeva</li>
            <li>Devolver o animal à Upeva caso não possa mais mantê-lo, em vez de descartá-lo</li>
            <li>Castrar o animal dentro do prazo estabelecido no contrato de adoção, caso ainda não seja castrado</li>
            <li>Aceitar visitas e contatos de acompanhamento pós-adoção realizados pela equipe da Upeva</li>
            <li>Assumir <strong className="text-foreground">responsabilidade civil total</strong> pelo animal após a assinatura do contrato, incluindo danos ou incidentes causados pelo animal</li>
          </ul>
        </Section>

        <Section title="Responsabilidades da Upeva" icon={ShieldCheck}>
          <ul className="list-disc list-inside flex flex-col gap-1">
            <li>Analisar as candidaturas com critério e boa-fé, priorizando o bem-estar animal</li>
            <li>Manter a confidencialidade dos dados fornecidos no formulário, conforme a{' '}
              <Link to="/politica-de-privacidade" className="text-primary hover:underline">Política de Privacidade</Link>
            </li>
            <li>Entregar animais com histórico veterinário disponível, vacinação em dia e, quando possível, castrados</li>
            <li>Responder às solicitações dos titulares de dados em até 15 dias úteis</li>
          </ul>
          <p>
            A Upeva não se responsabiliza por eventuais incompatibilidades comportamentais descobertas
            após a adoção, comprometendo-se, no entanto, a oferecer orientação e suporte à família adotante.
          </p>
        </Section>

        <Section title="Limitações e isenções" icon={Scale}>
          <p>
            A plataforma é oferecida "como está", sem garantia de disponibilidade contínua. A Upeva
            envidará esforços razoáveis para manter o sistema operacional, mas não se responsabiliza
            por perdas decorrentes de indisponibilidade técnica.
          </p>
          <p>
            Estes Termos podem ser atualizados a qualquer momento. Candidaturas enviadas antes de uma
            atualização seguem os termos vigentes no momento do envio.
          </p>
        </Section>

        <Section title="Legislação aplicável" icon={Scale}>
          <p>
            Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de
            Flores da Cunha/RS para dirimir quaisquer controvérsias.
          </p>
        </Section>

        <Section title="Contato" icon={Mail}>
          <p>
            Dúvidas sobre estes Termos ou sobre o processo de adoção? Entre em contato:{' '}
            <a href={`mailto:${DPO_EMAIL}`} className="text-primary hover:underline">{DPO_EMAIL}</a>
          </p>
        </Section>

        <motion.div variants={fadeUp} className="flex flex-wrap gap-4 text-sm">
          <Link to="/politica-de-privacidade" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
          <Link to="/animais" className="text-primary hover:underline">
            ← Voltar para os animais
          </Link>
        </motion.div>

      </motion.div>
    </div>
  )
}
