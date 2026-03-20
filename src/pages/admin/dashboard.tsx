import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PawPrint, ClipboardList, Plus, ArrowRight, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { AnimalStatusBadge, ApplicationStatusBadge } from '@/components/ui'
import { useAdminAnimals } from '@/features/animals/hooks/use-admin-animals'
import { useApplications } from '@/features/adoption/hooks/use-applications'
import { formatRelativeDate } from '@/utils/format'
import type { Timestamp } from '@/types/common'

function tsToDate(ts: Timestamp | undefined): Date {
  if (!ts) return new Date(0)
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts as unknown as number)
}

export function DashboardPage() {
  const { data: animals = [], isLoading: animalsLoading } = useAdminAnimals()
  const { data: applications = [], isLoading: appsLoading } = useApplications()

  const stats = useMemo(() => ({
    available:   animals.filter((a) => a.status === 'available').length,
    pending:     applications.filter((a) => a.status === 'pending').length,
    in_review:   applications.filter((a) => a.status === 'in_review').length,
    approved:    applications.filter((a) => a.status === 'approved').length,
  }), [animals, applications])

  const recentApplications = useMemo(
    () => [...applications].slice(0, 6),
    [applications],
  )

  const isLoading = animalsLoading || appsLoading

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visão geral da plataforma Upeva
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Animais disponíveis',
            value: stats.available,
            icon: PawPrint,
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            label: 'Candidaturas pendentes',
            value: stats.pending,
            icon: Clock,
            color: 'text-warning',
            bg: 'bg-warning/10',
          },
          {
            label: 'Em análise',
            value: stats.in_review,
            icon: ClipboardList,
            color: 'text-secondary',
            bg: 'bg-secondary/10',
          },
          {
            label: 'Aprovadas',
            value: stats.approved,
            icon: CheckCircle,
            color: 'text-success',
            bg: 'bg-success/10',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
              <Icon size={18} className={color} strokeWidth={1.75} />
            </div>
            <div>
              {isLoading ? (
                <Spinner size="sm" className="my-1" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link to="/admin/animais/novo" className="w-full sm:w-auto">
          <Button className="w-full gap-1.5 sm:w-auto">
            <Plus size={16} />
            Cadastrar animal
          </Button>
        </Link>
        <Link to="/admin/candidaturas" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full gap-1.5 sm:w-auto">
            <ClipboardList size={16} />
            Ver candidaturas
          </Button>
        </Link>
      </div>

      {/* Recent applications */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Candidaturas recentes
          </h2>
          <Link to="/admin/candidaturas">
            <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary">
              Ver todas
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>

        {appsLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {!appsLoading && recentApplications.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <XCircle size={32} className="text-muted-foreground mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Nenhuma candidatura recebida ainda.</p>
          </div>
        )}

        {!appsLoading && recentApplications.length > 0 && (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {recentApplications.map((app) => (
              <Link
                key={app.id}
                to={`/admin/candidaturas/${app.id}`}
                className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground truncate">
                    {app.fullName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {app.animalName} · {formatRelativeDate(tsToDate(app.createdAt))}
                  </span>
                </div>
                <ApplicationStatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent animals */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Animais cadastrados
          </h2>
          <Link to="/admin/animais">
            <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary">
              Ver todos
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>

        {animalsLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {!animalsLoading && animals.slice(0, 5).length > 0 && (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {animals.slice(0, 5).map((animal) => (
              <Link
                key={animal.id}
                to={`/admin/animais/${animal.id}/editar`}
                className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                  {animal.photos[animal.coverPhotoIndex] ? (
                    <img
                      src={animal.photos[animal.coverPhotoIndex]}
                      alt={animal.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <PawPrint size={14} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground truncate block">
                    {animal.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(tsToDate(animal.createdAt))}
                  </span>
                </div>
                <AnimalStatusBadge status={animal.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
