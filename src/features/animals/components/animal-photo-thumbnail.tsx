import { PawPrint } from 'lucide-react'
import { cn } from '@/utils/cn'

const SIZE_CONFIG = {
  sm: { container: 'h-9 w-9 rounded-md', icon: 14 },
  md: { container: 'h-16 w-16 rounded-xl', icon: 18 },
  lg: { container: 'h-24 w-24 rounded-xl', icon: 24 },
} as const

export interface AnimalPhotoThumbnailProps {
  src?: string | null
  alt: string
  size?: keyof typeof SIZE_CONFIG
  className?: string
}

export function AnimalPhotoThumbnail({
  src,
  alt,
  size = 'sm',
  className,
}: AnimalPhotoThumbnailProps) {
  const { container, icon } = SIZE_CONFIG[size]

  return (
    <div className={cn('shrink-0 overflow-hidden bg-muted', container, className)}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <PawPrint size={icon} className="text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
