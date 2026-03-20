import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApplicationStatusBadge, Button, Card, ResponsiveDataList } from '@/components/ui'
import type { Column } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { AdminHeaderOverflow } from '@/features/admin/components/admin-header-overflow'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useHeaderCompaction } from '@/features/admin/hooks/use-header-compaction'
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
  const { containerRef, measureRef, isCompact } = useHeaderCompaction()

  const filtered = useMemo(
    () =>
      activeTab === 'all'
        ? applications
        : applications.filter((a) => a.status === activeTab),
    [applications, activeTab],
  )

  const statusCounts = useMemo(
    () =>
      STATUS_TABS.reduce<Record<string, number>>((acc, { value }) => {
        if (value === 'all') {
          acc[value] = applications.length
          return acc
        }

        acc[value] = applications.filter((application) => application.status === value).length
        return acc
      }, {}),
    [applications],
  )

  const tabButtons = useMemo(
    () =>
      STATUS_TABS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setActiveTab(value)}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            activeTab === value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
          )}
        >
          {label}
          {value !== 'all' && (
            <span className="ml-1.5 rounded-full bg-background/70 px-1.5 py-0.5 text-xs text-muted-foreground">
              {statusCounts[value]}
            </span>
          )}
        </button>
      )),
    [activeTab, statusCounts],
  )

  const headerActions = useMemo(
    () => (
      <div ref={containerRef} className="relative flex min-w-0 items-center gap-2">
        <div
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 inline-flex items-center gap-2 whitespace-nowrap"
        >
          {tabButtons}
        </div>

        {!isCompact && (
          <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
            {tabButtons}
          </div>
        )}

        {isCompact && (
          <AdminHeaderOverflow
            label={activeTab === 'all' ? 'Filtros' : 'Status'}
            active={activeTab !== 'all'}
          >
            {(close) => (
              <div className="grid gap-2">
                {STATUS_TABS.map(({ value, label }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={activeTab === value ? 'default' : 'outline'}
                    className="w-full justify-between"
                    onClick={() => {
                      setActiveTab(value)
                      close()
                    }}
                  >
                    <span>{label}</span>
                    {value !== 'all' && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          activeTab === value
                            ? 'bg-primary-foreground/15 text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {statusCounts[value]}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </AdminHeaderOverflow>
        )}
      </div>
    ),
    [activeTab, containerRef, isCompact, measureRef, statusCounts, tabButtons],
  )

  const headerConfig = useMemo(
    () => ({
      actions: headerActions,
    }),
    [headerActions],
  )

  useAdminPageHeader(headerConfig)

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
      <p className="text-sm text-muted-foreground">
        {filtered.length} candidatura{filtered.length !== 1 ? 's' : ''}
      </p>

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
        <ResponsiveDataList
          columns={columns}
          data={filtered}
          keyExtractor={(a) => a.id}
          onRowClick={(a) => navigate(`/admin/candidaturas/${a.id}`)}
          renderMobileCard={(application) => (
            <ApplicationMobileCard
              application={application}
              onOpen={() => navigate(`/admin/candidaturas/${application.id}`)}
            />
          )}
          emptyMessage="Nenhuma candidatura encontrada."
        />
      )}
    </div>
  )
}

function ApplicationMobileCard({
  application,
  onOpen,
}: {
  application: AdoptionApplication
  onOpen: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="cursor-pointer"
    >
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">
              {application.fullName}
            </p>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {application.email}
            </p>
          </div>
          <ApplicationStatusBadge status={application.status} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-muted/35 p-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Animal
            </p>
            <p className="mt-1 text-sm text-foreground">
              {application.animalName}
            </p>
            <p className="text-xs text-muted-foreground">
              {SPECIES_LABELS[application.species]}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recebida
            </p>
            <p className="mt-1 text-sm text-foreground">
              {formatRelativeDate(tsToDate(application.createdAt))}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
