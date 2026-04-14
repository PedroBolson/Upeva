import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Heart,
  PawPrint,
  Shield,
  Users,
  ClipboardCheck,
  HomeIcon,
  ArrowRight,
  Banknote,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { fadeUp, stagger } from '@/utils/animations'
import { buildPublicTitle, useDocumentTitle } from '@/utils/page-title'

// TODO: confirmar número do WhatsApp para contato
const WHATSAPP_NUMBER = 'XXXXXXXXXXX'
const PIX_KEY = '54984030187'

const values = [
  {
    icon: Heart,
    title: 'Amor e respeito',
    description:
      'Todo animal tem valor. Tratamos cada resgate com o cuidado e a dignidade que merecem.',
  },
  {
    icon: Shield,
    title: 'Responsabilidade',
    description:
      'Realizamos triagem veterinária e vacinação antes de cada adoção.',
  },
  {
    icon: ClipboardCheck,
    title: 'Processo criterioso',
    description:
      'Analisamos cada candidatura para garantir que o animal vá para um lar seguro e amoroso.',
  },
  {
    icon: HomeIcon,
    title: 'Lar para sempre',
    description:
      'Nosso compromisso não termina na adoção. Acompanhamos e apoiamos as famílias adotantes.',
  },
]

const adoptionSteps = [
  {
    step: '01',
    title: 'Triagem e resgate',
    description:
      'Animais resgatados passam por avaliação veterinária completa, recebem vacinas, vermífugos e, quando possível, são castrados.',
  },
  {
    step: '02',
    title: 'Divulgação',
    description:
      'Os animais são fotografados, descritos e cadastrados na plataforma para que possíveis adotantes possam conhecê-los.',
  },
  {
    step: '03',
    title: 'Candidatura',
    description:
      'O interessado preenche nosso formulário detalhado. Avaliamos o perfil e, quando adequado, agendamos uma visita.',
  },
  {
    step: '04',
    title: 'Vistoria e entrega',
    description:
      'Realizamos uma análise do formulário enviado. Aprovado, o animal é entregue com todo amor.',
  },
]

export function AboutPage() {
  useDocumentTitle(buildPublicTitle('Sobre a Upeva'))
  const [pixCopied, setPixCopied] = useState(false)

  function copyPix() {
    navigator.clipboard.writeText(PIX_KEY)
    setPixCopied(true)
    setTimeout(() => setPixCopied(false), 2000)
  }
  return (
    <div className="flex flex-col">
      <div className="bg-linear-to-br from-accent via-background to-background">
        <section className="pt-24 pb-20 sm:pt-36">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-14"
            >
              <div className="flex max-w-2xl flex-col gap-5">
                <motion.div variants={fadeUp}>
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                    <PawPrint size={14} />
                    Nossa história
                  </span>
                </motion.div>
                <motion.h1
                  variants={fadeUp}
                  className="text-4xl sm:text-5xl font-bold text-foreground leading-tight"
                >
                  Quem é a <span className="text-primary">Upeva</span>
                </motion.h1>
                <motion.p
                  variants={fadeUp}
                  className="text-lg text-muted-foreground leading-relaxed"
                >
                  Fundada em 2008 em Flores da Cunha (RS), somos uma ONG movida por
                  voluntários dedicados a resgatar, castrar e cuidar de cães e gatos —
                  até que encontrem um lar definitivo.
                </motion.p>
              </div>

              <motion.div variants={fadeUp} className="flex justify-center lg:justify-end">
                <div className="group relative w-full max-w-105">
                  <div
                    aria-hidden="true"
                    className="absolute inset-6 rounded-full bg-primary/12 blur-3xl"
                  />
                  <div className="relative overflow-hidden rounded-full border border-border/70 bg-card/85 p-4 shadow-[0_24px_60px_-24px_color-mix(in_oklab,var(--foreground)_22%,transparent)] backdrop-blur">
                    <div className="relative overflow-hidden rounded-full">
                      <img
                        src="/upeva.jpg"
                        alt="Logo da Upeva"
                        className="aspect-square w-full rounded-full object-cover transition-transform duration-500 group-hover:scale-[1.045]"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-[-30%] w-[22%] rotate-12 bg-linear-to-r from-transparent via-background/80 to-transparent opacity-0 blur-sm transition-all duration-700 group-hover:left-[108%] group-hover:opacity-100"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16 w-full">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.155 }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start"
          >
            <motion.div variants={fadeUp} className="flex min-h-24 flex-col gap-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Nossa missão
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Nossos animais vivem na chácara da entidade na Capela Medianeira, ou
                nas casas de voluntários. A superlotação é um desafio
                constante — cada adoção faz uma diferença real. Além dos resgates,
                trabalhamos pela conscientização para que as pessoas não maltratem e
                não abandonem os animais.
              </p>
            </motion.div>

            <motion.div variants={fadeUp}>
              <div className="grid grid-cols-2 gap-4">
                {values.map((v) => (
                  <div
                    key={v.title}
                    className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
                  >
                    <div className="rounded-lg bg-primary/10 w-10 h-10 flex items-center justify-center">
                      <v.icon className="text-primary" size={20} strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{v.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {v.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </section>

      </div>

      <section className="bg-muted/30 border-y border-border py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={stagger}
            className="flex flex-col gap-12"
          >
            <motion.div variants={fadeUp} className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Nosso processo de adoção
              </h2>
              <p className="text-muted-foreground mt-2">
                Cada etapa existe para proteger o animal e a família adotante
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {adoptionSteps.map((s) => (
                <motion.div
                  key={s.step}
                  variants={fadeUp}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
                >
                  <span className="text-3xl font-bold text-primary/30">{s.step}</span>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 w-full">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.155 }}
          variants={stagger}
          className="flex flex-col gap-8"
        >
          <motion.div variants={fadeUp} className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Como apoiar a Upeva
            </h2>
            <p className="text-muted-foreground mt-2">
              Existem várias formas de fazer parte dessa causa
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            {/* Card: Adote */}
            <motion.div
              variants={fadeUp}
              className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4"
            >
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
                <Heart className="text-primary" size={22} strokeWidth={1.75} />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <h3 className="font-semibold text-foreground">Adote</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A melhor forma de apoiar é adotar responsavelmente. Abra seu coração e seu lar para um animal.
                </p>
              </div>
              <Link to="/animais">
                <Button variant="outline" size="sm" className="gap-1.5 w-full">
                  Ver animais
                  <ArrowRight size={14} />
                </Button>
              </Link>
            </motion.div>

            {/* Card: Doe via PIX */}
            <motion.div
              variants={fadeUp}
              className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4"
            >
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
                <Banknote className="text-primary" size={22} strokeWidth={1.75} />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <h3 className="font-semibold text-foreground">Doe</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sua doação cobre vacinas, castrações e cuidados veterinários. Qualquer valor faz diferença.
                </p>
                <div
                  onClick={copyPix}
                  className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/70 transition-colors"
                >
                  <span className="text-xs font-mono text-foreground select-all">{PIX_KEY}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">Chave PIX</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 w-full"
                onClick={copyPix}
              >
                {pixCopied ? (
                  <>
                    <Check size={14} className="text-green-500" />
                    Chave copiada!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copiar chave PIX
                  </>
                )}
              </Button>
            </motion.div>

            {/* Card: Voluntarie-se + Lar temporário */}
            <motion.div
              variants={fadeUp}
              className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4"
            >
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
                <Users className="text-primary" size={22} strokeWidth={1.75} />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <h3 className="font-semibold text-foreground">Voluntarie-se</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ajude com cuidados, transporte ou divulgação — ou ofereça um lar temporário enquanto o animal aguarda sua família definitiva.
                </p>
              </div>
              <a
                href={`https://wa.me/55${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5 w-full">
                  <MessageCircle size={14} />
                  Entre em contato
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>
    </div>
  )
}
