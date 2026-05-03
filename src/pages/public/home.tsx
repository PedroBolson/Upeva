import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ClipboardList, PawPrint, Shield, Users } from 'lucide-react'
import { Button } from '@/components/ui'
import { FeaturedAnimalRail } from '@/features/animals/components/featured-animal-rail'
import { HeroVideo } from '@/features/home/components/hero-video'
import { fadeUp, stagger } from '@/utils/animations'
import { buildPublicTitle, usePageSeo } from '@/utils/page-title'

const steps = [
  {
    icon: PawPrint,
    title: 'Escolha um animal',
    description: 'Navegue pelos cães e gatos disponíveis e encontre aquele que tocou seu coração.',
  },
  {
    icon: ClipboardList,
    title: 'Preencha a candidatura',
    description: 'Responda ao formulário de adoção. Suas respostas nos ajudam a garantir o melhor lar.',
  },
  {
    icon: Shield,
    title: 'Conclua a adoção',
    description: 'Após a análise, assine o contrato e leve seu novo companheiro para casa.',
  },
]

export function HomePage() {
  usePageSeo({
    title: buildPublicTitle(),
    description:
      'Conheça a Upeva, ONG de Flores da Cunha que resgata cães e gatos e promove adoção responsável.',
    path: '/',
  })

  return (
    <div className="flex flex-col">
      <HeroVideo />

      {/* #animais anchor lands here — at the animal rail, not at the hero top */}
      <div id="animais">
        <FeaturedAnimalRail />
      </div>

      {/* #sobre anchor lands here */}
      <section id="sobre" className="bg-muted/30 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={stagger}
            className="flex flex-col gap-12"
          >
            <motion.div variants={fadeUp} className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Como funciona a adoção
              </h2>
              <p className="text-muted-foreground mt-2">
                Um processo simples, seguro e transparente
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  variants={fadeUp}
                  className="flex flex-col items-center text-center gap-4"
                >
                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <step.icon className="text-primary" size={26} strokeWidth={1.75} />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-base mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 w-full">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl bg-primary px-8 py-12 text-center flex flex-col items-center gap-6"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/15">
            <Users className="text-primary-foreground" size={28} strokeWidth={1.75} />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary-foreground">
              Pronto para adotar?
            </h2>
            <p className="text-primary-foreground/80">
              Encontre o companheiro ideal e inicie o processo de adoção hoje mesmo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/adotar">
              <Button variant="inverted" size="lg" className="gap-2">
                <ClipboardList size={17} />
                Iniciar candidatura
              </Button>
            </Link>
            <Link to="/animais">
              <Button
                variant="outline"
                size="lg"
                className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <PawPrint size={18} />
                Vitrine virtual
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
