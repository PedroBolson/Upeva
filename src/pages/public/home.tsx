import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, ArrowRight, PawPrint, Shield, Users } from 'lucide-react'
import { Button, AnimalCardSkeleton, EmptyState, ErrorState } from '@/components/ui'
import { AnimalCard } from '@/features/animals/components/animal-card'
import { useFeaturedAnimals } from '@/features/animals/hooks/use-animals'
import { fadeUp, stagger } from '@/utils/animations'

const steps = [
  {
    icon: PawPrint,
    title: 'Escolha um animal',
    description: 'Navegue pelos cães e gatos disponíveis e encontre aquele que tocou seu coração.',
  },
  {
    icon: Heart,
    title: 'Preencha a candidatura',
    description: 'Responda ao formulário de adoção. Suas respostas nos ajudam a garantir o melhor lar.',
  },
  {
    icon: Shield,
    title: 'Conclua a adoção',
    description: 'Após a análise e visita, assine o contrato e leve seu novo companheiro para casa.',
  },
]

export function HomePage() {
  const { data: featured = [], isLoading, error, refetch } = useFeaturedAnimals(6)

  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-linear-to-br from-accent via-background to-background">
        {/* Decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/8 blur-2xl"
        />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col items-start gap-6 max-w-2xl"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <PawPrint size={14} />
                ONG de adoção de animais
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight"
            >
              Todo animal merece{' '}
              <span className="text-primary">um lar</span>
              {' '}com amor
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg text-muted-foreground leading-relaxed max-w-lg"
            >
              A Upeva conecta cães e gatos resgatados com famílias que querem dar amor.
              Adote um companheiro e transforme duas vidas ao mesmo tempo.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
              <Link to="/animais">
                <Button size="lg" className="gap-2">
                  <Heart size={18} />
                  Quero adotar
                </Button>
              </Link>
              <Link to="/sobre">
                <Button variant="outline" size="lg">
                  Conheça a Upeva
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Featured animals ─────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 w-full">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={stagger}
          className="flex flex-col gap-10"
        >
          <motion.div
            variants={fadeUp}
            className="flex items-end justify-between gap-4 flex-wrap"
          >
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Esperando por você
              </h2>
              <p className="text-muted-foreground mt-1">
                Conheça alguns dos animais disponíveis para adoção
              </p>
            </div>
            <Link to="/animais">
              <Button variant="ghost" className="gap-1.5 text-primary hover:text-primary">
                Ver todos
                <ArrowRight size={16} />
              </Button>
            </Link>
          </motion.div>

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <AnimalCardSkeleton key={i} />
              ))}
            </div>
          )}

          {error && (
            <ErrorState
              description="Não foi possível carregar os animais agora. Tente novamente."
              onRetry={refetch}
            />
          )}

          {!isLoading && !error && featured.length === 0 && (
            <EmptyState
              icon={PawPrint}
              title="Em breve novos animais"
              description="Ainda não temos animais cadastrados, mas logo teremos novidades!"
            />
          )}

          {!isLoading && !error && featured.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((animal) => (
                <AnimalCard key={animal.id} animal={animal} />
              ))}
            </div>
          )}

          {featured.length > 0 && (
            <motion.div variants={fadeUp} className="flex justify-center">
              <Link to="/animais">
                <Button variant="outline" size="lg" className="gap-2">
                  Ver todos os animais
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="bg-muted/30 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
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

      {/* ── CTA final ────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 w-full">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
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
                <PawPrint size={18} />
                Iniciar candidatura
              </Button>
            </Link>
            <Link to="/animais">
              <Button
                variant="outline"
                size="lg"
                className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Heart size={16} className="mr-2" />
                Ver animais
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
