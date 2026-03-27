import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CalendarClock, HeartHandshake, Loader2, Mail, PawPrint, UserRound } from 'lucide-react'
import { Button, Card, Select, ApplicationStatusBadge } from '@/components/ui'
import { DetailSection, DetailField } from '@/components/ui/detail-view'
import { Textarea } from '@/components/ui/textarea'
import { PageSpinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useApplication } from '@/features/adoption/hooks/use-application'
import { useUpdateApplicationStatus } from '@/features/adoption/hooks/use-application-mutations'
import { SPECIES_LABELS, SIZE_LABELS, SEX_LABELS } from '@/features/animals/types/animal.types'
import { APPLICATION_STATUS_OPTIONS } from '@/features/adoption/config/application-status-options'
import type { ApplicationStatus, Timestamp } from '@/types/common'

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

function formatPreferenceLabel(
  value: string | undefined,
  labels: Record<string, string>,
): string {
  if (!value) return '—'
  if (value === 'any') return 'Sem preferência'
  return labels[value] ?? value
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
  const [adminNotesDraft, setAdminNotesDraft] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const currentStatus = selectedStatus ?? app?.status ?? 'pending'
  const formattedCreatedAt = useMemo(() => tsToDate(app?.createdAt), [app?.createdAt])
  const formattedUpdatedAt = useMemo(() => tsToDate(app?.updatedAt), [app?.updatedAt])
  const adminNotes = adminNotesDraft ?? app?.adminNotes ?? ''

  function handleSave() {
    if (!id) return
    updateStatus(
      { id, status: currentStatus, adminNotes },
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
      <div className="mx-auto max-w-xl">
        <ErrorState description="Não foi possível carregar a candidatura." onRetry={refetch} />
      </div>
    )
  }

  const hasSpecificAnimal = Boolean(app.animalId)
  const animalLabel = hasSpecificAnimal ? app.animalName ?? 'Animal vinculado' : 'Interesse geral'
  const animalHelper = hasSpecificAnimal
    ? SPECIES_LABELS[app.species]
    : app.species === 'dog'
      ? `Sexo: ${formatPreferenceLabel(app.preferredSex, SEX_LABELS)} · Porte: ${formatPreferenceLabel(app.preferredSize, SIZE_LABELS)}`
      : `Adoção conjunta: ${app.jointAdoption === undefined ? '—' : app.jointAdoption ? 'Sim' : 'Não'}`

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card className="border-border/80 p-6">
        <Link
          to="/admin/candidaturas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Voltar para Candidaturas
        </Link>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{app.fullName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasSpecificAnimal ? (
                <>
                  Candidatura para <strong className="text-foreground">{app.animalName}</strong>
                  {' '}({SPECIES_LABELS[app.species]})
                </>
              ) : (
                <>
                  Candidatura geral para adoção de{' '}
                  <strong className="text-foreground">{SPECIES_LABELS[app.species].toLowerCase()}</strong>
                </>
              )}
              {' '}· {formattedCreatedAt}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={UserRound}
                label="Candidato"
                value={app.fullName}
                helper={app.cpf}
              />
              <SummaryCard
                icon={PawPrint}
                label={hasSpecificAnimal ? 'Animal' : 'Busca'}
                value={animalLabel}
                helper={animalHelper}
              />
              <SummaryCard
                icon={Mail}
                label="Contato"
                value={app.email}
                helper={app.phone}
              />
              <SummaryCard
                icon={CalendarClock}
                label="Última atualização"
                value={formattedUpdatedAt}
                helper={`Recebida em ${formattedCreatedAt}`}
              />
            </div>
          </div>
          <div className="flex justify-start lg:justify-end">
            <ApplicationStatusBadge status={app.status} />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-6 2xl:grid-cols-2">
          {/* Step 1: Identificação */}
          <DetailSection title="Identificação">
            <DetailField label="Nome completo" value={app.fullName} />
            <DetailField label="CPF" value={app.cpf || undefined} />
            <DetailField label="E-mail" value={app.email} />
            <DetailField label="Telefone" value={app.phone} />
            <DetailField label="Data de nascimento" value={app.birthDate} />
            <DetailField label="CEP" value={app.cep || undefined} />
            <div className="sm:col-span-2">
              <DetailField
                label="Endereço"
                value={
                  app.address
                    ? `${app.address.street}, ${app.address.number}${app.address.complement ? ` ${app.address.complement}` : ''} — ${app.address.city}/${app.address.state}`
                    : '—'
                }
              />
            </div>
          </DetailSection>

          {/* Step 2: Preferências */}
          {!hasSpecificAnimal && (
            <DetailSection title="Preferências para o animal">
              {app.species === 'dog' ? (
                <>
                  <DetailField
                    label="Sexo preferido"
                    value={formatPreferenceLabel(app.preferredSex, SEX_LABELS)}
                  />
                  <DetailField
                    label="Porte preferido"
                    value={formatPreferenceLabel(app.preferredSize, SIZE_LABELS)}
                  />
                </>
              ) : (
                <DetailField label="Adoção conjunta" value={<Bool value={app.jointAdoption} />} />
              )}
            </DetailSection>
          )}

          {/* Step 3: Família */}
          <DetailSection title="Família">
            <DetailField label="Adultos na casa" value={app.adultsCount} />
            <DetailField label="Crianças na casa" value={app.childrenCount} />
            {Number(app.childrenCount) > 0 && (
              <DetailField label="Idades das crianças" value={app.childrenAges} />
            )}
          </DetailSection>

          {/* Step 4: Estilo de vida */}
          <DetailSection title="Estilo de vida">
            <div className="sm:col-span-2">
              <DetailField label="Motivo da adoção" value={app.adoptionReason} />
            </div>
            <DetailField label="Horas em casa por dia" value={app.hoursHomePeoplePerDay} />
            {app.species === 'cat' && (
              <DetailField label="É um presente?" value={<Bool value={app.isGift} />} />
            )}
          </DetailSection>

          {/* Step 5: Moradia */}
          <DetailSection title="Moradia">
            <DetailField
              label="Tipo de moradia"
              value={app.housingType ? HOUSING_LABELS[app.housingType] ?? app.housingType : '—'}
            />
            <DetailField label="Imóvel alugado?" value={<Bool value={app.isRented} />} />
            {app.isRented && (
              <DetailField label="Proprietário permite pets?" value={<Bool value={app.landlordAllowsPets} />} />
            )}
          </DetailSection>

          {/* Step 6: Histórico */}
          <DetailSection title="Histórico com animais">
            <DetailField label="Já teve animais?" value={<Bool value={app.hadPetsBefore} />} />
            {app.hadPetsBefore && (
              <div className="sm:col-span-2">
                <DetailField label="Animais anteriores" value={app.previousPets} />
              </div>
            )}
            <DetailField label="Tem animais atualmente?" value={<Bool value={app.hasCurrentPets} />} />
            {app.hasCurrentPets && (
              <>
                <DetailField label="Quantidade" value={app.currentPetsCount} />
                {app.species === 'cat' && (
                  <>
                    <DetailField label="Vacinados?" value={<Bool value={app.currentPetsVaccinated} />} />
                    {app.currentPetsVaccinated === false && (
                      <div className="sm:col-span-2">
                        <DetailField label="Motivo sem vacinação" value={app.currentPetsVaccinationReason} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </DetailSection>

          {/* Step 7: Compromisso */}
          <DetailSection title="Compromisso" className="2xl:col-span-2">
            <DetailField label="Pode arcar com os custos?" value={<Bool value={app.canAffordCosts} />} />
            <DetailField label="Compromisso de longo prazo?" value={<Bool value={app.longTermCommitment} />} />
            <div className="sm:col-span-2">
              <DetailField label="Se arranhar/morder alguém" value={app.scratchBehaviorResponse} />
            </div>
            <div className="sm:col-span-2">
              <DetailField label="Se fugir/se perder" value={app.escapeResponse} />
            </div>
            <div className="sm:col-span-2">
              <DetailField label="Se não puder mais ficar" value={app.cannotKeepResponse} />
            </div>
          </DetailSection>

          {/* Step 8: Termos */}
          <DetailSection title="Termos aceitos" className="2xl:col-span-2">
            <DetailField label="Política de devolução" value={<Bool value={app.acceptsReturnPolicy} />} />
            <DetailField label="Compromisso de castração" value={<Bool value={app.acceptsCastrationPolicy} />} />
            <DetailField label="Aceita acompanhamento" value={<Bool value={app.acceptsFollowUp} />} />
            <DetailField label="Não repassar o animal" value={<Bool value={app.acceptsNoResale} />} />
            <DetailField label="Termos de responsabilidade" value={<Bool value={app.acceptsLiabilityTerms} />} />
            <DetailField label="Confirmação de responsabilidade" value={<Bool value={app.acceptsResponsibility} />} />
            {app.comments && (
              <div className="sm:col-span-2">
                <DetailField label="Observações do candidato" value={app.comments} />
              </div>
            )}
          </DetailSection>
        </div>

        <div className="flex flex-col gap-6 xl:sticky xl:top-24 xl:self-start">
          <Card className="border-border/80 p-5">
            <div className="flex items-center gap-2">
              <HeartHandshake size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Triagem</h2>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <Select
                label="Status"
                options={APPLICATION_STATUS_OPTIONS}
                value={currentStatus}
                onChange={(value) => setSelectedStatus(value as ApplicationStatus)}
              />

              <Textarea
                label="Nota interna"
                placeholder="Motivo, observações para a equipe…"
                rows={6}
                value={adminNotes}
                onChange={(e) => setAdminNotesDraft(e.target.value)}
              />
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <Button onClick={handleSave} disabled={isPending} className="w-full gap-1.5">
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {isPending ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              {saved && (
                <span className="text-sm text-success">Salvo com sucesso.</span>
              )}
            </div>
          </Card>

          <Card className="border-border/80 p-5">
            <h2 className="text-sm font-semibold text-foreground">Resumo rápido</h2>
            <div className="mt-4 flex flex-col gap-4">
              <SidebarField label="Status atual do formulário" value={<ApplicationStatusBadge status={app.status} />} />
              <SidebarField
                label={hasSpecificAnimal ? 'Animal' : 'Busca'}
                value={hasSpecificAnimal ? `${animalLabel} (${SPECIES_LABELS[app.species]})` : `${animalLabel} · ${animalHelper}`}
              />
              <SidebarField label="Recebida em" value={formattedCreatedAt} />
              <SidebarField label="Última atualização" value={formattedUpdatedAt} />
              <SidebarField label="Contato" value={`${app.email} · ${app.phone}`} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ElementType
  label: string
  value: string
  helper?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}

function SidebarField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  )
}
