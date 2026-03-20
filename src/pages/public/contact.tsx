import { motion } from 'framer-motion'
import {
  Mail,
  Phone,
  Instagram,
  MapPin,
  Clock,
  PawPrint,
  ExternalLink,
} from 'lucide-react'
import { fadeUp, stagger } from '@/utils/animations'

const channels = [
  {
    icon: Instagram,
    label: 'Instagram',
    value: '@upeva.ong',
    href: 'https://instagram.com/upeva.ong',
    description: 'Acompanhe nossos animais e novidades',
    external: true,
  },
  {
    icon: Phone,
    label: 'WhatsApp',
    value: '(xx) 9xxxx-xxxx',
    href: 'https://wa.me/55xxxxxxxxxx',
    description: 'Segunda a sexta, das 9h às 18h',
    external: true,
  },
  {
    icon: Mail,
    label: 'E-mail',
    value: 'contato@upeva.org.br',
    href: 'mailto:contato@upeva.org.br',
    description: 'Respondemos em até 2 dias úteis',
    external: false,
  },
  {
    icon: MapPin,
    label: 'Localização',
    value: 'Brasil',
    href: undefined,
    description: 'Atendimento por agendamento',
    external: false,
  },
]

const faqs = [
  {
    q: 'O processo de adoção tem custo?',
    a: 'Sim. Para concluir a adoção, é necessário ressarcir as vacinas já aplicadas no animal, além do vermífugo e antipulgas. O valor exato é informado no momento da entrega.',
  },
  {
    q: 'Quanto tempo dura o processo?',
    a: 'Após o envio da candidatura, nossa equipe analisa o formulário e, se aprovado, entra em contato para agendamento da visita. O processo costuma levar de 5 a 15 dias.',
  },
  {
    q: 'Posso adotar de outra cidade?',
    a: 'Analisamos cada caso individualmente. Entre em contato para conversar sobre a viabilidade da adoção à distância.',
  },
  {
    q: 'Posso devolver o animal?',
    a: 'Sim. Se por qualquer motivo não puder mais cuidar do animal, ele deve ser devolvido à Upeva — nunca repassado para terceiros sem nosso conhecimento. Isso está previsto no contrato de adoção.',
  },
]

export function ContactPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-linear-to-br from-accent via-background to-background py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="max-w-xl flex flex-col gap-4"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <PawPrint size={14} />
                Fale conosco
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl font-bold text-foreground leading-tight"
            >
              Entre em <span className="text-primary">contato</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground">
              Tem dúvidas sobre adoção, quer voluntariar ou oferecer um lar temporário?
              Nossa equipe está aqui para ajudar.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Channels */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 w-full">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
          className="flex flex-col gap-8"
        >
          <motion.h2 variants={fadeUp} className="text-2xl font-bold text-foreground">
            Canais de atendimento
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {channels.map((c) => (
              <motion.div
                key={c.label}
                variants={fadeUp}
                className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
              >
                <div className="rounded-lg bg-primary/10 w-10 h-10 flex items-center justify-center">
                  <c.icon className="text-primary" size={18} strokeWidth={1.75} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {c.label}
                  </span>
                  {c.href ? (
                    <a
                      href={c.href}
                      target={c.external ? '_blank' : undefined}
                      rel={c.external ? 'noopener noreferrer' : undefined}
                      className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {c.value}
                      {c.external && <ExternalLink size={11} />}
                    </a>
                  ) : (
                    <span className="text-sm font-semibold text-foreground">{c.value}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{c.description}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Hours notice */}
          <motion.div
            variants={fadeUp}
            className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4"
          >
            <Clock size={16} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Nossa equipe de voluntários responde mensagens em horário comercial.
              Para urgências relacionadas a maus-tratos ou abandono, acione os
              órgãos competentes da sua cidade.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="bg-muted/30 border-t border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            variants={stagger}
            className="flex flex-col gap-8"
          >
            <motion.div variants={fadeUp}>
              <h2 className="text-2xl font-bold text-foreground">
                Perguntas frequentes
              </h2>
              <p className="text-muted-foreground mt-1">
                Respondemos as dúvidas mais comuns sobre adoção
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {faqs.map((faq) => (
                <motion.div
                  key={faq.q}
                  variants={fadeUp}
                  className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2"
                >
                  <h3 className="font-semibold text-foreground text-sm">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
