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

export function AdminListSkeleton({ rows = 8, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-5">
      <div className="mb-5 flex flex-col gap-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3.5 w-52" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <Skeleton className="h-3.5 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} columns={columns} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border/80 bg-card p-6">
            <Skeleton className="mb-6 h-5 w-40" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
              <div className="flex h-72 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted/30">
                <div className="flex h-44 w-44 items-center justify-center rounded-full border border-border/70 bg-card">
                  <Skeleton className="h-20 w-20" rounded="full" />
                </div>
              </div>
              <div className="grid gap-3">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border/80 bg-card">
            <div className="flex items-center justify-between p-6 pb-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 px-6 py-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3.5 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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
