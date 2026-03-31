import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApplicationStatusBadge, Badge, Button, Card, ResponsiveDataList, Select } from '@/components/ui'
import type { Column } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { AdminListSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { AdminHeaderOverflow } from '@/features/admin/components/admin-header-overflow'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useHeaderCompaction } from '@/features/admin/hooks/use-header-compaction'
import { useCounts } from '@/features/admin/hooks/use-counts'
import { useApplications } from '@/features/adoption/hooks/use-applications'
import { APPLICATION_STATUS_TABS } from '@/features/adoption/config/application-status-options'
import { SPECIES_LABELS } from '@/features/animals/types/animal.types'
import { formatRelativeDate, tsToDate } from '@/utils/format'
import { buildAdminTitle, useDocumentTitle } from '@/utils/page-title'
import type { AdoptionApplication } from '@/features/adoption/types/adoption.types'
import type { ApplicationStatus, Timestamp } from '@/types/common'
import { cn } from '@/utils/cn'

function getApplicationSubject(application: AdoptionApplication) {
  return application.animalId ? application.animalName ?? 'Animal vinculado' : 'Interesse geral'
}

function getApplicationSubjectMeta(application: AdoptionApplication) {
  return application.animalId
    ? SPECIES_LABELS[application.species]
    : `Adoção geral · ${SPECIES_LABELS[application.species]}`
}

export function ApplicationsPage() {
  useDocumentTitle(buildAdminTitle('Candidaturas'))

  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ApplicationStatus | 'all'>('all')
  const [animalFilter, setAnimalFilter] = useState('')
  const [sortColumn, setSortColumn] = useState<string>('queue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { containerRef, measureRef, isCompact } = useHeaderCompaction()

  const { data: counts } = useCounts()

  const {
    applications: allApplications,
    hasMore,
    isLoading,
    isFetchingMore,
    error,
    fetchMore,
    refetch,
  } = useApplications(null)

  const applications = useMemo(
    () => activeTab === 'all' ? allApplications : allApplications.filter((a) => a.status === activeTab),
    [allApplications, activeTab],
  )

  const animalOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { value: string; label: string }[] = []
    for (const a of applications) {
      const name = a.animalName
      if (name && !seen.has(name)) {
        seen.add(name)
        options.push({ value: name, label: name })
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [applications])

  const filteredApplications = useMemo(() => {
    if (!animalFilter) return applications
    return applications.filter((a) => a.animalName === animalFilter)
  }, [applications, animalFilter])

  const sortKeys: Record<string, (a: AdoptionApplication) => string | number> = {
    applicant: (a) => a.fullName.toLowerCase(),
    contact: (a) => a.email.toLowerCase(),
    animal: (a) => (a.animalName ?? '').toLowerCase(),
    queue: (a) => {
      const active = a.status === 'pending' || a.status === 'in_review'
      return active ? (a.queuePosition ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
    },
    status: (a) => a.status,
    date: (a) => (a.createdAt as Timestamp | undefined)?.seconds ?? 0,
  }

  function handleSort(key: string) {
    if (sortColumn === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(key)
      setSortDir('asc')
    }
  }

  const sortedApplications = useMemo(() => {
    const fn = sortKeys[sortColumn]
    if (!fn) return filteredApplications
    return [...filteredApplications].sort((a, b) => {
      const av = fn(a)
      const bv = fn(b)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredApplications, sortColumn, sortDir])

  // Counts for tab badges come from metadata (no extra reads)
  const statusCounts = useMemo(() => {
    const base: Record<string, number> = {
      all: counts?.applications?.total ?? 0,
      pending: counts?.applications?.pending ?? 0,
      in_review: counts?.applications?.in_review ?? 0,
      approved: counts?.applications?.approved ?? 0,
      rejected: counts?.applications?.rejected ?? 0,
      withdrawn: counts?.applications?.withdrawn ?? 0,
    }
    return base
  }, [counts])

  const activeTabLabel = useMemo(
    () => APPLICATION_STATUS_TABS.find((tab) => tab.value === activeTab)?.label ?? 'Todas',
    [activeTab],
  )

  const tabButtons = useMemo(
    () =>
      APPLICATION_STATUS_TABS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setActiveTab(value)}
          aria-current={activeTab === value ? 'true' : undefined}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            activeTab === value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
          )}
        >
          {label}
          {statusCounts[value] > 0 && (
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
          <>
            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
              {tabButtons}
            </div>
            {animalOptions.length > 0 && (
              <div className="w-44 shrink-0">
                <Select
                  options={[{ value: '', label: 'Todos os animais' }, ...animalOptions]}
                  value={animalFilter}
                  onChange={(v) => setAnimalFilter(v)}
                />
              </div>
            )}
          </>
        )}

        {isCompact && (
          <AdminHeaderOverflow
            label="Filtros"
            active={activeTab !== 'all' || !!animalFilter}
          >
            {(close) => (
              <div className="grid gap-2">
                {APPLICATION_STATUS_TABS.map(({ value, label }) => (
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
                    {statusCounts[value] > 0 && (
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
                {animalOptions.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                    <span className="text-xs font-medium text-muted-foreground">Animal</span>
                    <Select
                      options={[{ value: '', label: 'Todos os animais' }, ...animalOptions]}
                      value={animalFilter}
                      onChange={(v) => {
                        setAnimalFilter(v)
                        close()
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </AdminHeaderOverflow>
        )}
      </div>
    ),
    [activeTab, animalFilter, animalOptions, containerRef, isCompact, measureRef, statusCounts, tabButtons],
  )

  useAdminPageHeader(useMemo(() => ({ actions: headerActions }), [headerActions]))

  const columns: Column<AdoptionApplication>[] = [
    {
      key: 'applicant',
      header: 'Candidato',
      sortKey: sortKeys.applicant,
      cell: (a) => (
        <div>
          <p className="font-medium text-foreground">{a.fullName}</p>
          <p className="text-xs text-muted-foreground">{a.cpf}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contato',
      sortKey: sortKeys.contact,
      cell: (a) => (
        <div>
          <p className="text-sm text-foreground">{a.email}</p>
          <p className="text-xs text-muted-foreground">{a.phone}</p>
        </div>
      ),
    },
    {
      key: 'animal',
      header: 'Animal',
      sortKey: sortKeys.animal,
      cell: (a) => (
        <div>
          <p className="text-foreground">{getApplicationSubject(a)}</p>
          <p className="text-xs text-muted-foreground">{getApplicationSubjectMeta(a)}</p>
        </div>
      ),
    },
    {
      key: 'queue',
      header: 'Posição',
      sortKey: sortKeys.queue,
      cell: (a) => (a.status === 'pending' || a.status === 'in_review') && a.queuePosition
        ? <Badge variant="warning">#{a.queuePosition}º na fila</Badge>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: sortKeys.status,
      cell: (a) => <ApplicationStatusBadge status={a.status} />,
    },
    {
      key: 'date',
      header: 'Data',
      sortKey: sortKeys.date,
      cell: (a) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeDate(tsToDate(a.createdAt as Timestamp | undefined))}
        </span>
      ),
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {isLoading && <AdminListSkeleton rows={8} columns={6} />}

      {error && (
        <ErrorState
          description="Não foi possível carregar as candidaturas."
          onRetry={refetch}
        />
      )}

      {!isLoading && !error && (
        <Card className="border-border/80 p-5">
          <div className="mb-4 flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              {sortedApplications.length} candidatura{sortedApplications.length !== 1 ? 's' : ''}{' '}
              {animalFilter ? 'encontrada' : 'carregada'}{sortedApplications.length !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-muted-foreground">
              Mostrando o status <strong className="text-foreground">{activeTabLabel}</strong>.
            </p>
          </div>

          <ResponsiveDataList
            columns={columns}
            data={sortedApplications}
            keyExtractor={(a) => a.id}
            onRowClick={(a) => navigate(`/admin/candidaturas/${a.id}`)}
            renderMobileCard={(application) => (
              <ApplicationMobileCard
                application={application}
                onOpen={() => navigate(`/admin/candidaturas/${application.id}`)}
              />
            )}
            emptyMessage="Nenhuma candidatura encontrada."
            sortColumn={sortColumn}
            sortDir={sortDir}
            onSort={handleSort}
            animated
          />
        </Card>
      )}

      {/* Load more */}
      {!isLoading && !error && (hasMore || isFetchingMore) && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchMore()}
            disabled={isFetchingMore}
            className="min-w-40"
          >
            {isFetchingMore ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Carregando…
              </span>
            ) : (
              'Carregar mais candidaturas'
            )}
          </Button>
        </div>
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
            <p className="mt-1 wrap-break-words text-sm text-muted-foreground">
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
              {getApplicationSubject(application)}
            </p>
            <p className="text-xs text-muted-foreground">
              {getApplicationSubjectMeta(application)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recebida
            </p>
            <p className="mt-1 text-sm text-foreground">
              {formatRelativeDate(tsToDate(application.createdAt as Timestamp | undefined))}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
