import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import { cn } from '@/utils/cn'

interface AnimalPhotoGalleryProps {
  photos: string[]
  animalName: string
  coverPhotoIndex?: number
  className?: string
}

export function AnimalPhotoGallery({
  photos,
  animalName,
  coverPhotoIndex = 0,
  className,
}: AnimalPhotoGalleryProps) {
  const [selected, setSelected] = useState(
    photos.length > 0 ? Math.min(coverPhotoIndex, photos.length - 1) : 0,
  )
  const [direction, setDirection] = useState(0)

  // Clamp the raw index to a valid range whenever photos.length changes (e.g.
  // async photo updates). This is also the safety net when key-based remounting
  // has not yet occurred and props have changed ahead of state.
  const safeSelected = photos.length > 0 ? Math.min(selected, photos.length - 1) : 0

  function goTo(index: number) {
    setDirection(index > safeSelected ? 1 : -1)
    setSelected(index)
  }

  function prev() {
    goTo(safeSelected > 0 ? safeSelected - 1 : photos.length - 1)
  }

  function next() {
    goTo(safeSelected < photos.length - 1 ? safeSelected + 1 : 0)
  }

  if (photos.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-muted aspect-4/3',
          className,
        )}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageOff size={40} strokeWidth={1.5} />
          <span className="text-sm">Sem fotos disponíveis</span>
        </div>
      </div>
    )
  }

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Main photo */}
      <div
        className="relative rounded-xl overflow-hidden aspect-4/3 bg-muted"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') prev()
          if (e.key === 'ArrowRight') next()
        }}
        tabIndex={photos.length > 1 ? 0 : -1}
        aria-label="Galeria de fotos"
        role="region"
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={safeSelected}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            src={photos[safeSelected]}
            alt={`${animalName} — foto ${safeSelected + 1} de ${photos.length}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>

        {/* Nav arrows */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Foto anterior"
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 z-10',
                'flex h-9 w-9 items-center justify-center rounded-full',
                'bg-background/70 backdrop-blur-sm border border-border',
                'text-foreground hover:bg-background/90 transition-colors',
              )}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Próxima foto"
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 z-10',
                'flex h-9 w-9 items-center justify-center rounded-full',
                'bg-background/70 backdrop-blur-sm border border-border',
                'text-foreground hover:bg-background/90 transition-colors',
              )}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para foto ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  i === safeSelected
                    ? 'w-4 bg-primary-foreground'
                    : 'w-1.5 bg-primary-foreground/50',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div
          role="list"
          aria-label="Miniaturas"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {photos.map((src, i) => (
            <button
              key={i}
              type="button"
              role="listitem"
              onClick={() => goTo(i)}
              aria-label={`Foto ${i + 1}`}
              aria-pressed={i === safeSelected}
              className={cn(
                'h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-150',
                i === safeSelected
                  ? 'border-primary'
                  : 'border-transparent hover:border-border',
              )}
            >
              <img
                src={src}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
