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
} from 'lucide-react'
import { Button } from '@/components/ui'
import { fadeUp, stagger } from '@/utils/animations'

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
      'Realizamos triagem veterinária, vacinação e castração antes de cada adoção.',
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
      'Realizamos uma visita para verificar o ambiente. Aprovado, assina-se o contrato e o animal é entregue com todo amor.',
  },
]

export function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-linear-to-br from-accent via-background to-background py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="max-w-2xl flex flex-col gap-5"
          >
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
              Somos uma organização sem fins lucrativos dedicada ao resgate, cuidado
              e adoção responsável de cães e gatos. Acreditamos que todo animal
              merece viver com dignidade, saúde e amor.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 w-full">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          <motion.div variants={fadeUp} className="flex flex-col gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Nossa missão
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              A Upeva nasceu da indignação e do amor. Sabendo que milhares de animais
              vivem nas ruas sem cuidados, decidimos agir. Nosso trabalho é conectar
              animais resgatados com famílias comprometidas, garantindo que cada
              adoção seja responsável e duradoura.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Trabalhamos com voluntários apaixonados, parceiros veterinários e uma
              rede de lares temporários para garantir que todo animal receba o cuidado
              necessário antes de encontrar seu lar definitivo.
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

      {/* Process */}
      <section className="bg-muted/30 border-y border-border py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
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

      {/* Support */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 w-full">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
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
            {[
              {
                icon: Heart,
                title: 'Adote',
                description:
                  'A melhor forma de apoiar é adotar responsavelmente. Abra seu coração e seu lar para um animal.',
                cta: { label: 'Ver animais', to: '/animais' },
              },
              {
                icon: Users,
                title: 'Voluntarie-se',
                description:
                  'Precisamos de mãos voluntárias para cuidados, transporte, eventos e divulgação nas redes.',
                cta: { label: 'Entrar em contato', to: '/contato' },
              },
              {
                icon: Shield,
                title: 'Lar temporário',
                description:
                  'Ofereça abrigo temporário a um animal enquanto ele aguarda sua família definitiva.',
                cta: { label: 'Saber mais', to: '/contato' },
              },
            ].map((item) => (
              <motion.div
                key={item.title}
                variants={fadeUp}
                className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4"
              >
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
                  <item.icon className="text-primary" size={22} strokeWidth={1.75} />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <Link to={item.cta.to}>
                  <Button variant="outline" size="sm" className="gap-1.5 w-full">
                    {item.cta.label}
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>
    </div>
  )
}
