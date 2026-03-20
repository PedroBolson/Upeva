import type { Variants } from 'framer-motion'

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0 },
}

export const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
}

export const staggerFast: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08 } },
}
