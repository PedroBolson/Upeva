import { cn } from '@/utils/cn'
import { Card } from './card'
import { DataTable, type Column } from './data-table'

interface ResponsiveDataListProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  renderMobileCard: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
  mobileClassName?: string
  sortColumn?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

export function ResponsiveDataList<T>({
  columns,
  data,
  keyExtractor,
  renderMobileCard,
  onRowClick,
  emptyMessage = 'Nenhum resultado encontrado.',
  className,
  mobileClassName,
  sortColumn,
  sortDir,
  onSort,
}: ResponsiveDataListProps<T>) {
  if (data.length === 0) {
    return (
      <Card className={cn('p-8 text-center text-sm text-muted-foreground', className)}>
        {emptyMessage}
      </Card>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={data}
          keyExtractor={keyExtractor}
          onRowClick={onRowClick}
          emptyMessage={emptyMessage}
          sortColumn={sortColumn}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>

      <div className={cn('space-y-3 md:hidden', mobileClassName)}>
        {data.map((row) => (
          <div key={keyExtractor(row)}>
            {renderMobileCard(row)}
          </div>
        ))}
      </div>
    </div>
  )
}
