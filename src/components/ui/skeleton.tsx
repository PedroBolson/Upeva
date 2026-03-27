import { cn } from '@/utils/cn'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export function Skeleton({ className, rounded = 'md', ...props }: SkeletonProps) {
  const roundedClasses = {
    sm:   'rounded-sm',
    md:   'rounded-md',
    lg:   'rounded-lg',
    full: 'rounded-full',
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-muted',
        roundedClasses[rounded],
        className,
      )}
      {...props}
    />
  )
}

export function MetricCardSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <Skeleton className="h-10 w-10" rounded="lg" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3.5 w-28" />
      </div>
    </div>
  )
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr aria-hidden="true" className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-35" />
        </td>
      ))}
    </tr>
  )
}

export function ListItemSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <Skeleton className="h-9 w-9 shrink-0" rounded="md" />
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16" rounded="full" />
    </div>
  )
}

export function AnimalCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Skeleton className="h-56 w-full" rounded="sm" />
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </div>
  )
}
