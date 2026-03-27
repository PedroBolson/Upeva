import { AnimatePresence, motion } from 'framer-motion'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  className?: string
  sortKey?: (row: T) => string | number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
  sortColumn?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  animated?: boolean
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Nenhum resultado encontrado.',
  className,
  sortColumn,
  sortDir,
  onSort,
  animated = false,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            {columns.map((col) => {
              const sortable = Boolean(col.sortKey && onSort)
              const isActive = sortColumn === col.key
              return (
                <th
                  key={col.key}
                  scope="col"
                  onClick={sortable ? () => onSort!(col.key) : undefined}
                  className={cn(
                    'px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap',
                    sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                    isActive && 'text-foreground',
                    col.className,
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortable && (
                      isActive
                        ? sortDir === 'asc'
                          ? <ChevronUp size={13} />
                          : <ChevronDown size={13} />
                        : <ChevronsUpDown size={13} className="opacity-40" />
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-border bg-card">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : animated ? (
            <AnimatePresence initial={false}>
              {data.map((row) => (
                <motion.tr
                  key={keyExtractor(row)}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    opacity: { duration: 0.15 },
                    layout: { duration: 0.2, ease: 'easeOut' },
                  }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors duration-100',
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 text-foreground', col.className)}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'transition-colors duration-100',
                  onRowClick && 'cursor-pointer hover:bg-muted/50',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3 text-foreground', col.className)}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
