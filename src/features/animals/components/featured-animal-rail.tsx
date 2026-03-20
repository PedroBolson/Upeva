import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, PawPrint } from 'lucide-react'
import { AnimalCardSkeleton, Button, EmptyState, ErrorState } from '@/components/ui'
import { AnimalCard } from './animal-card'
import { useFeaturedAnimals } from '../hooks/use-animals'
import { fadeUp, stagger } from '@/utils/animations'

const railItemClassName =
  'min-w-[260px] max-w-[320px] flex-none snap-start md:min-w-0 md:max-w-none'

export function FeaturedAnimalRail() {
  const { data: featured = [], isLoading, error, refetch } = useFeaturedAnimals(4, 'random')

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 w-full">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        variants={stagger}
        className="flex flex-col gap-8"
      >
        <motion.div
          variants={fadeUp}
          className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Esperando por você
            </h2>
            <p className="mt-1 text-muted-foreground">
              Alguns encontros começam por acaso. Veja quem pode cruzar o seu caminho hoje.
            </p>
          </div>

          <Link to="/animais">
            <Button variant="outline" size="lg" className="w-full gap-2 md:w-auto">
              Ver todos os animais
              <ArrowRight size={16} />
            </Button>
          </Link>
        </motion.div>

        {isLoading && (
          <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={railItemClassName}>
                <AnimalCardSkeleton />
              </div>
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
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {featured.map((animal) => (
              <div key={animal.id} className={railItemClassName}>
                <AnimalCard animal={animal} className="h-full" />
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </section>
  )
}
