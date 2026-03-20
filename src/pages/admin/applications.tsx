import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataTable, ApplicationStatusBadge } from '@/components/ui'
import type { Column } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useApplications } from '@/features/adoption/hooks/use-applications'
import { SPECIES_LABELS } from '@/features/animals/types/animal.types'
import { formatRelativeDate } from '@/utils/format'
import type { AdoptionApplication } from '@/features/adoption/types/adoption.types'
import type { ApplicationStatus, Timestamp } from '@/types/common'
import { cn } from '@/utils/cn'

const STATUS_TABS: Array<{ value: ApplicationStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'in_review', label: 'Em análise' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'rejected', label: 'Rejeitadas' },
  { value: 'withdrawn', label: 'Retiradas' },
]

function tsToDate(ts: Timestamp | undefined): Date {
  if (!ts) return new Date(0)
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts as unknown as number)
}

export function ApplicationsPage() {
  const navigate = useNavigate()
  const { data: applications = [], isLoading, error, refetch } = useApplications()
  const [activeTab, setActiveTab] = useState<ApplicationStatus | 'all'>('all')

  const filtered = useMemo(
    () =>
      activeTab === 'all'
        ? applications
        : applications.filter((a) => a.status === activeTab),
    [applications, activeTab],
  )

  const columns: Column<AdoptionApplication>[] = [
    {
      key: 'applicant',
      header: 'Candidato',
      cell: (a) => (
        <div>
          <p className="font-medium text-foreground">{a.fullName}</p>
          <p className="text-xs text-muted-foreground">{a.email}</p>
        </div>
      ),
    },
    {
      key: 'animal',
      header: 'Animal',
      cell: (a) => (
        <div>
          <p className="text-foreground">{a.animalName}</p>
          <p className="text-xs text-muted-foreground">{SPECIES_LABELS[a.species]}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => <ApplicationStatusBadge status={a.status} />,
    },
    {
      key: 'date',
      header: 'Data',
      cell: (a) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeDate(tsToDate(a.createdAt))}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Candidaturas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {filtered.length} candidatura{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {value !== 'all' && (
              <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">
                {applications.filter((a) => a.status === value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {error && (
        <ErrorState
          description="Não foi possível carregar as candidaturas."
          onRetry={refetch}
        />
      )}

      {!isLoading && !error && (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(a) => a.id}
          onRowClick={(a) => navigate(`/admin/candidaturas/${a.id}`)}
          emptyMessage="Nenhuma candidatura encontrada."
        />
      )}
    </div>
  )
}
