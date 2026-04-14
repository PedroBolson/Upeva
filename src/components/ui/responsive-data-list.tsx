import { AnimatePresence, motion } from 'framer-motion'
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
  animated?: boolean
  breakpoint?: 'md' | 'lg' | 'xl'
}

const tableVisible = { md: 'hidden md:block', lg: 'hidden lg:block', xl: 'hidden xl:block' }
const cardsVisible = { md: 'space-y-3 md:hidden', lg: 'space-y-3 lg:hidden', xl: 'space-y-3 xl:hidden' }

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
  animated = false,
  breakpoint = 'md',
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
      <div className={tableVisible[breakpoint]}>
        <DataTable
          columns={columns}
          data={data}
          keyExtractor={keyExtractor}
          onRowClick={onRowClick}
          emptyMessage={emptyMessage}
          sortColumn={sortColumn}
          sortDir={sortDir}
          onSort={onSort}
          animated={animated}
        />
      </div>

      <div className={cn(cardsVisible[breakpoint], mobileClassName)}>
        {animated ? (
          <AnimatePresence initial={false}>
            {data.map((row) => (
              <motion.div
                key={keyExtractor(row)}
                layout="position"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{
                  opacity: { duration: 0.15 },
                  layout: { duration: 0.2, ease: 'easeOut' },
                }}
              >
                {renderMobileCard(row)}
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          data.map((row) => (
            <div key={keyExtractor(row)}>
              {renderMobileCard(row)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
