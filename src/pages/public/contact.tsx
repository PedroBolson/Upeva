import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { contactHubLinks } from '@/features/contact/config/contact-links'
import { ContactLinkCard } from '@/features/contact/components/contact-link-card'
import { ContactSocialRow } from '@/features/contact/components/contact-social-row'
import { fadeUp, stagger } from '@/utils/animations'

export function ContactPage() {
  return (
    <div className="relative overflow-hidden bg-linear-to-br from-accent via-background to-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-8 right-0 h-60 w-60 rounded-full bg-secondary/12 blur-3xl"
      />

      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="rounded-[2rem] border border-border bg-card/90 p-6 shadow-xl backdrop-blur sm:p-8"
        >
          <motion.div variants={fadeUp} className="flex flex-col items-center text-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 ring-8 ring-background shadow-sm sm:h-36 sm:w-36">
              <img
                src="/upeva.jpg"
                alt="Logo da Upeva"
                className="h-24 w-24 rounded-full object-cover shadow-sm sm:h-28 sm:w-28"
              />
            </div>

            <div className="mt-6 max-w-2xl">
              <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-[2.65rem]">
                União Pela Vida Animal
                <span className="block text-primary">Upeva</span>
              </h1>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                Resgates, adoção responsável e formas reais de apoiar a causa.
              </p>
            </div>

            <div className="mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-muted-foreground">
              <Heart size={14} className="text-primary" />
              <span className="truncate sm:whitespace-normal">
                No bio, os caminhos para acompanhar e ajudar.
              </span>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-8">
            <ContactSocialRow />
          </motion.div>

          <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-4">
            {contactHubLinks.map((item) => (
              <ContactLinkCard key={item.label} item={item} />
            ))}
          </motion.div>
        </motion.div>
      </section>
    </div>
  )
}
