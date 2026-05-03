import { Card } from '@/components/ui'
import type React from 'react'

export type TraceabilityRow = {
  label: string
  value?: React.ReactNode
}

export function TraceabilityCard({
  title,
  rows,
}: {
  title: string
  rows: TraceabilityRow[]
}) {
  return (
    <Card className="border-border/80 p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <MetadataRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </Card>
  )
}

export function MetadataRow({
  label,
  value,
}: {
  label: string
  value?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground wrap-break-words whitespace-pre-wrap">
        {value ?? 'Não registrado'}
      </span>
    </div>
  )
}
