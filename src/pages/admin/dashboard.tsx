import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  PawPrint,
  UserPlus,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ApplicationStatusBadge,
  AnimalStatusBadge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui'
import { AnimalPhotoThumbnail } from '@/features/animals/components/animal-photo-thumbnail'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useCounts } from '@/features/admin/hooks/use-counts'
import { db } from '@/lib/firebase'
import { SPECIES_LABELS } from '@/features/animals/types/animal.types'
import { formatRelativeDate, tsToDate } from '@/utils/format'
import type { AdoptionApplication } from '@/features/adoption/types/adoption.types'
import type { Animal } from '@/features/animals/types/animal.types'
import type { AnimalStatus, ApplicationStatus, Timestamp } from '@/types/common'

const numberFormatter = new Intl.NumberFormat('pt-BR')

const animalStatusConfig = [
  { key: 'available', label: 'Disponível', color: 'var(--success)' },
  { key: 'under_review', label: 'Em análise', color: 'var(--warning)' },
  { key: 'adopted', label: 'Adotado', color: 'var(--secondary)' },
  { key: 'archived', label: 'Arquivado', color: 'var(--muted-foreground)' },
] as const satisfies ReadonlyArray<{ key: AnimalStatus; label: string; color: string }>

const applicationStatusConfig = [
  { key: 'pending', label: 'Pendente', color: 'var(--warning)' },
  { key: 'in_review', label: 'Em análise', color: 'var(--primary)' },
  { key: 'approved', label: 'Aprovada', color: 'var(--success)' },
  { key: 'rejected', label: 'Recusada', color: 'var(--danger)' },
  { key: 'withdrawn', label: 'Desistência', color: 'var(--muted-foreground)' },
] as const satisfies ReadonlyArray<{ key: ApplicationStatus; label: string; color: string }>

interface StatusDatum {
  key: string
  label: string
  value: number
  color: string
}

interface RecentListState<T> {
  items: T[]
  isLoading: boolean
  error: unknown
}

// Lightweight query — only the latest 6 applications
function useRecentApplications() {
  return useQuery<AdoptionApplication[]>({
    queryKey: ['applications', 'recent'],
    queryFn: async () => {
      const q = query(
        collection(db, 'applications'),
        orderBy('createdAt', 'desc'),
        limit(6),
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdoptionApplication))
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })
}

// Lightweight query — only the latest 5 animals
function useRecentAnimals() {
  return useQuery<Animal[]>({
    queryKey: ['animals', 'recent'],
    queryFn: async () => {
      const q = query(
        collection(db, 'animals'),
        orderBy('createdAt', 'desc'),
        limit(5),
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Animal))
    },
    staleTime: 1000 * 60 * 8,
    refetchOnWindowFocus: false,
  })
}

function getApplicationContext(app: AdoptionApplication) {
  const subject = app.animalId ? app.animalName ?? 'Animal vinculado' : 'Interesse geral'
  return `${subject} · ${formatRelativeDate(tsToDate(app.createdAt))}`
}

function DistributionLegend({
  data,
  totalLabel,
}: {
  data: StatusDatum[]
  totalLabel?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      {data.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/35 px-3 py-2.5"
        >
          <div className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="text-sm text-foreground">{item.label}</span>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {numberFormatter.format(item.value)}
          </span>
        </div>
      ))}
      {totalLabel && (
        <div className="rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
          {totalLabel}
        </div>
      )}
    </div>
  )
}

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
      <div className="relative h-72 overflow-hidden rounded-2xl border border-border/70 bg-muted/30">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-44 w-44 items-center justify-center rounded-full border border-border/70 bg-card">
            <Skeleton className="h-20 w-20 rounded-full" rounded="full" />
          </div>
        </div>
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <span className="sr-only">{title}</span>
    </div>
  )
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function RecentApplicationsPanel({ items, isLoading, error }: RecentListState<AdoptionApplication>) {
  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Candidaturas recentes</CardTitle>
        </div>
        <Link to="/admin/candidaturas" className="shrink-0">
          <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary">
            Ver todas
            <ArrowRight size={14} />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading && (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-6 py-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3.5 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && Boolean(error) && (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            Não foi possível carregar as candidaturas.
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            Nenhuma candidatura recebida ainda.
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="divide-y divide-border">
            {items.map((app) => (
              <Link
                key={app.id}
                to={`/admin/candidaturas/${app.id}`}
                className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-muted/35 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{app.fullName}</p>
                  <p className="truncate text-sm text-muted-foreground">{getApplicationContext(app)}</p>
                </div>
                <ApplicationStatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RecentAnimalsPanel({ items, isLoading, error }: RecentListState<Animal>) {
  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Últimos animais cadastrados</CardTitle>
        </div>
        <Link to="/admin/animais" className="shrink-0">
          <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary">
            Ver todos
            <ArrowRight size={14} />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading && (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-6 py-4">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && Boolean(error) && (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            Não foi possível carregar os animais.
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            Nenhum animal cadastrado ainda.
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="divide-y divide-border">
            {items.map((animal) => (
              <Link
                key={animal.id}
                to={`/admin/animais/${animal.id}/editar`}
                className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-muted/35 sm:flex-row sm:items-center"
              >
                <AnimalPhotoThumbnail
                  src={animal.photos[animal.coverPhotoIndex]}
                  alt={animal.name}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{animal.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {SPECIES_LABELS[animal.species]} · {formatRelativeDate(tsToDate(animal.createdAt as Timestamp | undefined))}
                  </p>
                </div>
                <AnimalStatusBadge status={animal.status} />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { data: counts, isLoading: countsLoading } = useCounts()
  const {
    data: recentApplications = [],
    isLoading: appsLoading,
    error: appsError,
  } = useRecentApplications()
  const {
    data: recentAnimals = [],
    isLoading: animalsLoading,
    error: animalsError,
  } = useRecentAnimals()

  const animalDistribution = useMemo(
    () => animalStatusConfig.map((item) => ({
      ...item,
      value: counts?.animals?.[item.key] ?? 0,
    })),
    [counts],
  )

  const applicationDistribution = useMemo(
    () => applicationStatusConfig.map((item) => ({
      ...item,
      value: counts?.applications?.[item.key] ?? 0,
    })),
    [counts],
  )

  const totals = useMemo(
    () => ({
      animals: counts?.animals?.total ?? animalDistribution.reduce((sum, item) => sum + item.value, 0),
      applications:
        counts?.applications?.total
        ?? applicationDistribution.reduce((sum, item) => sum + item.value, 0),
    }),
    [animalDistribution, applicationDistribution, counts],
  )

  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <Link to="/admin/animais/novo" className="shrink-0">
          <Button size="sm" className="h-9 gap-1.5 whitespace-nowrap px-3">
            <PawPrint size={16} />
            Cadastrar animal
          </Button>
        </Link>
        <Link to="/admin/usuarios" className="shrink-0">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 whitespace-nowrap px-3">
            <UserPlus size={16} />
            Novo usuário
          </Button>
        </Link>
      </div>
    ),
    [],
  )

  useAdminPageHeader(useMemo(() => ({ actions: headerActions }), [headerActions]))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Status dos animais</CardTitle>
            <CardDescription>
              Distribuição atual do plantel entre disponibilidade, adoção em andamento e histórico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {countsLoading ? (
              <ChartPlaceholder title="Carregando gráfico de animais" />
            ) : totals.animals === 0 ? (
              <EmptyChartState message="Sem animais cadastrados ainda para compor a distribuição." />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                <div className="relative h-72">
                  <div className="relative z-10 h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={animalDistribution}
                          dataKey="value"
                          nameKey="label"
                          innerRadius={78}
                          outerRadius={110}
                          paddingAngle={3}
                          stroke="var(--card)"
                          strokeWidth={4}
                        >
                          {animalDistribution.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [numberFormatter.format(Number(value)), name]}
                          wrapperStyle={{ zIndex: 20, pointerEvents: 'none' }}
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: '16px',
                            color: 'var(--foreground)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Total
                    </span>
                    <span className="text-3xl font-semibold text-foreground">
                      {numberFormatter.format(totals.animals)}
                    </span>
                  </div>
                </div>

                <DistributionLegend
                  data={animalDistribution}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Status das candidaturas</CardTitle>
            <CardDescription>
              Snapshot do funil atual de triagem, aprovação, recusas e desistências.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {countsLoading ? (
              <ChartPlaceholder title="Carregando gráfico de candidaturas" />
            ) : totals.applications === 0 ? (
              <EmptyChartState message="Sem candidaturas registradas ainda para compor a distribuição." />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                <div className="relative h-72">
                  <div className="relative z-10 h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={applicationDistribution}
                        layout="vertical"
                        margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
                      >
                        <CartesianGrid stroke="var(--border)" horizontal={false} />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={92}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        />
                        <Tooltip
                          cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
                          formatter={(value, name) => [numberFormatter.format(Number(value)), name]}
                          wrapperStyle={{ zIndex: 20, pointerEvents: 'none' }}
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: '16px',
                            color: 'var(--foreground)',
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 999, 999, 0]} maxBarSize={22}>
                          {applicationDistribution.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <DistributionLegend
                  data={applicationDistribution}
                  totalLabel={`${numberFormatter.format(totals.applications)} candidatura${totals.applications === 1 ? '' : 's'} acumulada${totals.applications === 1 ? '' : 's'} no sistema.`}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentApplicationsPanel
          items={recentApplications}
          isLoading={appsLoading}
          error={appsError}
        />
        <RecentAnimalsPanel
          items={recentAnimals}
          isLoading={animalsLoading}
          error={animalsError}
        />
      </div>
    </div>
  )
}
