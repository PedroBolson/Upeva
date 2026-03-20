import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button, Select, ApplicationStatusBadge } from '@/components/ui'
import { Textarea } from '@/components/ui/textarea'
import { PageSpinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useApplication } from '@/features/adoption/hooks/use-application'
import { useUpdateApplicationStatus } from '@/features/adoption/hooks/use-application-mutations'
import { SPECIES_LABELS, SIZE_LABELS, SEX_LABELS } from '@/features/animals/types/animal.types'
import type { ApplicationStatus, Timestamp } from '@/types/common'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_review', label: 'Em análise' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'rejected', label: 'Rejeitada' },
  { value: 'withdrawn', label: 'Retirada' },
]

const HOUSING_LABELS: Record<string, string> = {
  house_open_yard: 'Casa com quintal aberto',
  house_closed_yard: 'Casa com quintal fechado',
  house_no_yard: 'Casa sem quintal',
  apartment_no_screens: 'Apartamento sem telas',
  apartment_with_screens: 'Apartamento com telas',
  apartment: 'Apartamento',
}

function tsToDate(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts as unknown as number)
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(d)
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-foreground">{value || '—'}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function Bool({ value }: { value: boolean | undefined }) {
  if (value === undefined) return <span>—</span>
  return <span>{value ? 'Sim' : 'Não'}</span>
}

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: app, isLoading, error, refetch } = useApplication(id)
  const { mutate: updateStatus, isPending } = useUpdateApplicationStatus()

  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [saved, setSaved] = useState(false)

  const currentStatus = selectedStatus ?? app?.status ?? 'pending'

  function handleSave() {
    if (!id) return
    updateStatus(
      { id, status: currentStatus, adminNotes: adminNotes || undefined },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        },
      },
    )
  }

  if (isLoading) return <PageSpinner />
  if (error || !app) {
    return (
      <div className="max-w-xl">
        <ErrorState description="Não foi possível carregar a candidatura." onRetry={refetch} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          to="/admin/candidaturas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Voltar para Candidaturas
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{app.fullName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Candidatura para <strong className="text-foreground">{app.animalName}</strong>
              {' '}({SPECIES_LABELS[app.species]}) · {tsToDate(app.createdAt)}
            </p>
          </div>
          <ApplicationStatusBadge status={app.status} />
        </div>
      </div>

      {/* Admin actions */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Triagem</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={currentStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ApplicationStatus)}
            />
          </div>
          <div className="flex-1">
            <Textarea
              label="Nota interna (opcional)"
              placeholder="Motivo, observações para a equipe…"
              rows={2}
              value={adminNotes || app.adminNotes || ''}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isPending} className="gap-1.5">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isPending ? 'Salvando…' : 'Salvar'}
          </Button>
          {saved && (
            <span className="text-sm text-success">Salvo com sucesso.</span>
          )}
        </div>
      </div>

      {/* Step 1: Identificação */}
      <Section title="Identificação">
        <Field label="Nome completo" value={app.fullName} />
        <Field label="E-mail" value={app.email} />
        <Field label="Telefone" value={app.phone} />
        <Field label="Data de nascimento" value={app.birthDate} />
        <div className="sm:col-span-2">
          <Field
            label="Endereço"
            value={
              app.address
                ? `${app.address.street}, ${app.address.number}${app.address.complement ? ` ${app.address.complement}` : ''} — ${app.address.city}/${app.address.state}`
                : '—'
            }
          />
        </div>
      </Section>

      {/* Step 2: Preferências */}
      <Section title="Preferências para o animal">
        {app.species === 'dog' ? (
          <>
            <Field
              label="Sexo preferido"
              value={app.preferredSex ? (SEX_LABELS[app.preferredSex as keyof typeof SEX_LABELS] ?? app.preferredSex === 'any' ? 'Sem preferência' : app.preferredSex) : '—'}
            />
            <Field
              label="Porte preferido"
              value={app.preferredSize ? (SIZE_LABELS[app.preferredSize as keyof typeof SIZE_LABELS] ?? app.preferredSize === 'any' ? 'Sem preferência' : app.preferredSize) : '—'}
            />
          </>
        ) : (
          <Field label="Adoção conjunta" value={<Bool value={app.jointAdoption} />} />
        )}
      </Section>

      {/* Step 3: Família */}
      <Section title="Família">
        <Field label="Adultos na casa" value={app.adultsCount} />
        <Field label="Crianças na casa" value={app.childrenCount} />
        {Number(app.childrenCount) > 0 && (
          <Field label="Idades das crianças" value={app.childrenAges} />
        )}
      </Section>

      {/* Step 4: Estilo de vida */}
      <Section title="Estilo de vida">
        <div className="sm:col-span-2">
          <Field label="Motivo da adoção" value={app.adoptionReason} />
        </div>
        <Field label="Horas em casa por dia" value={app.hoursHomePeoplePerDay} />
        {app.species === 'cat' && (
          <Field label="É um presente?" value={<Bool value={app.isGift} />} />
        )}
      </Section>

      {/* Step 5: Moradia */}
      <Section title="Moradia">
        <Field
          label="Tipo de moradia"
          value={app.housingType ? HOUSING_LABELS[app.housingType] ?? app.housingType : '—'}
        />
        <Field label="Imóvel alugado?" value={<Bool value={app.isRented} />} />
        {app.isRented && (
          <Field label="Proprietário permite pets?" value={<Bool value={app.landlordAllowsPets} />} />
        )}
      </Section>

      {/* Step 6: Histórico */}
      <Section title="Histórico com animais">
        <Field label="Já teve animais?" value={<Bool value={app.hadPetsBefore} />} />
        {app.hadPetsBefore && (
          <div className="sm:col-span-2">
            <Field label="Animais anteriores" value={app.previousPets} />
          </div>
        )}
        <Field label="Tem animais atualmente?" value={<Bool value={app.hasCurrentPets} />} />
        {app.hasCurrentPets && (
          <>
            <Field label="Quantidade" value={app.currentPetsCount} />
            {app.species === 'cat' && (
              <>
                <Field label="Vacinados?" value={<Bool value={app.currentPetsVaccinated} />} />
                {app.currentPetsVaccinated === false && (
                  <div className="sm:col-span-2">
                    <Field label="Motivo sem vacinação" value={app.currentPetsVaccinationReason} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Section>

      {/* Step 7: Compromisso */}
      <Section title="Compromisso">
        <Field label="Pode arcar com os custos?" value={<Bool value={app.canAffordCosts} />} />
        <Field label="Compromisso de longo prazo?" value={<Bool value={app.longTermCommitment} />} />
        <div className="sm:col-span-2">
          <Field label="Se arranhar/morder alguém" value={app.scratchBehaviorResponse} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Se fugir/se perder" value={app.escapeResponse} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Se não puder mais ficar" value={app.cannotKeepResponse} />
        </div>
      </Section>

      {/* Step 8: Termos */}
      <Section title="Termos aceitos">
        <Field label="Política de devolução" value={<Bool value={app.acceptsReturnPolicy} />} />
        <Field label="Compromisso de castração" value={<Bool value={app.acceptsCastrationPolicy} />} />
        <Field label="Aceita acompanhamento" value={<Bool value={app.acceptsFollowUp} />} />
        <Field label="Não repassar o animal" value={<Bool value={app.acceptsNoResale} />} />
        <Field label="Termos de responsabilidade" value={<Bool value={app.acceptsLiabilityTerms} />} />
        <Field label="Confirmação de responsabilidade" value={<Bool value={app.acceptsResponsibility} />} />
        {app.comments && (
          <div className="sm:col-span-2">
            <Field label="Observações do candidato" value={app.comments} />
          </div>
        )}
      </Section>
    </div>
  )
}
