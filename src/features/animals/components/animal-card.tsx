import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ImageOff, ArrowRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui'
import type { Animal } from '../types/animal.types'
import { SPECIES_LABELS, SEX_LABELS, SIZE_LABELS } from '../types/animal.types'

interface AnimalCardProps {
  animal: Animal
  className?: string
}

export function AnimalCard({ animal, className }: AnimalCardProps) {
  const coverPhoto = animal.photos[animal.coverPhotoIndex] ?? animal.photos[0]

  // Detect if the cover image is already in the browser cache.
  // useLayoutEffect runs synchronously before paint, so if the image is complete
  // (cached), we set fromCache=true and the card skips its entry animation entirely
  // — no opacity-0 flash, no fake-reload feel.
  const [fromCache, setFromCache] = useState(false)
  const setImageRef = useCallback((node: HTMLImageElement | null) => {
    setFromCache(Boolean(node?.complete && node.naturalWidth > 0))
  }, [])

  return (
    <motion.article
      layout
      initial={fromCache ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={cn(
        'group flex flex-col rounded-xl border border-border bg-card overflow-hidden',
        'shadow-sm hover:shadow-md transition-shadow duration-200',
        className,
      )}
    >
      {/* Photo */}
      <Link
        to={`/animais/${animal.id}`}
        aria-label={`Ver ${animal.name}`}
        tabIndex={-1}
        className="block relative aspect-4/3 overflow-hidden bg-muted"
      >
        {coverPhoto ? (
          <img
            ref={setImageRef}
            src={coverPhoto}
            alt={animal.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageOff className="text-muted-foreground" size={32} strokeWidth={1.5} />
          </div>
        )}

        {/* Species badge overlay */}
        <div className="absolute top-3 left-3">
          <Badge variant={animal.species === 'dog' ? 'default' : 'secondary'}>
            {SPECIES_LABELS[animal.species]}
          </Badge>
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        <div>
          <Link
            to={`/animais/${animal.id}`}
            className="font-semibold text-foreground text-lg leading-tight hover:text-primary transition-colors"
          >
            {animal.name}
          </Link>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {SEX_LABELS[animal.sex]}
            </span>
            {animal.estimatedAge && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground">{animal.estimatedAge}</span>
              </>
            )}
            {animal.size && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground">{SIZE_LABELS[animal.size]}</span>
              </>
            )}
          </div>
        </div>

        {animal.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
            {animal.description}
          </p>
        )}

        <Link to={`/animais/${animal.id}`} className="mt-auto">
          <Button variant="outline" size="sm" className="w-full gap-1.5 group/btn">
            Conhecer
            <ArrowRight
              size={14}
              className="transition-transform duration-150 group-hover/btn:translate-x-0.5"
            />
          </Button>
        </Link>
      </div>
    </motion.article>
  )
}
