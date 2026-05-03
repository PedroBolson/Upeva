import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarClock, HeartHandshake, Info, Loader2, Mail, MessageCircle, PawPrint, type LucideIcon } from 'lucide-react'
import { Button, Card, ConfirmModal, Select, ApplicationStatusBadge } from '@/components/ui'
import { RejectionModal } from '@/features/adoption/components/rejection-modal'
import { AnimalQuickViewModal } from '@/features/animals/components/animal-quick-view-modal'
import { cn } from '@/utils/cn'
import { DetailSection, DetailField } from '@/components/ui/detail-view'
import { Textarea } from '@/components/ui/textarea'
import { PageSpinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useApplication } from '@/features/adoption/hooks/use-application'
import { useApplicationPII } from '@/features/adoption/hooks/use-application-pii'
import { useRejectionFlag } from '@/features/adoption/hooks/use-rejection-flag'
import { useUpdateApplicationReview } from '@/features/adoption/hooks/use-application-mutations'
import { TraceabilityCard } from '@/features/admin/components/traceability-card'
import { formatActorLabel, formatTraceDate } from '@/features/admin/utils/traceability'
import { getLinkableAnimalsForApplication } from '@/features/animals/services/animals.service'
import { getActiveApplicationsForAnimal } from '@/features/adoption/services/adoption.service'
import { SPECIES_LABELS, SIZE_LABELS, SEX_LABELS, type Animal } from '@/features/animals/types/animal.types'
import { APPLICATION_STATUS_OPTIONS } from '@/features/adoption/config/application-status-options'
import { formatDate } from '@/utils/format'
import { buildAdminTitle, useDocumentTitle } from '@/utils/page-title'
import type { ApplicationStatus, RejectionReason, Timestamp } from '@/types/common'
import type { AdoptionApplication } from '@/features/adoption/types/adoption.types'

const REJECTION_REASON_LABELS: Record<string, string> = {
  inadequate_housing: 'Moradia inadequada',
  no_landlord_permission: 'Sem autorização do proprietário',
  financial_instability: 'Instabilidade financeira',
  previous_animal_negligence: 'Histórico de negligência com animais',
  incompatible_lifestyle: 'Estilo de vida incompatível',
  other: 'Outro',
}

const HOUSING_LABELS: Record<string, string> = {
  house_open_yard: 'Casa com quintal aberto',
  house_closed_yard: 'Casa com quintal fechado',
  house_no_yard: 'Casa sem quintal',
  apartment_no_screens: 'Apartamento sem telas',
  apartment_with_screens: 'Apartamento com telas',
  apartment: 'Apartamento',
}

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pendente',
  in_review: 'Em análise',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  withdrawn: 'Retirada',
  declined: 'Declinada',
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

function isGeneralInterestApplication(app: AdoptionApplication): boolean {
  if (!app.animalId) return true
  if (app.species === 'dog') {
    return app.preferredSex !== undefined || app.preferredSize !== undefined
  }
  return app.jointAdoption !== undefined || app.preferredSex !== undefined
}

function buildLinkableAnimalLabel(animal: Animal): string {
  const meta = [
    SEX_LABELS[animal.sex],
    animal.species === 'dog' && animal.size ? SIZE_LABELS[animal.size] : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return meta ? `${animal.name} · ${meta}` : animal.name
}

function normalizePhoneToE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '')

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return null
}

function getWhatsAppHref(phone: string): string | null {
  const normalized = normalizePhoneToE164(phone)
  return normalized ? `https://wa.me/${normalized}` : null
}

function getReviewErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Não foi possível salvar as alterações. Tente novamente.'
}

function Bool({ value }: { value: boolean | undefined }) {
  if (value === undefined) return <span>—</span>
  return <span>{value ? 'Sim' : 'Não'}</span>
}

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: app, isLoading, error, refetch } = useApplication(id)
  const { data: pii, isLoading: piiLoading } = useApplicationPII(id)
  const { data: flagResult } = useRejectionFlag(id)
  const { mutate: updateReview, isPending } = useUpdateApplicationReview()

  useDocumentTitle(buildAdminTitle(app ? `Candidatura - ${app.fullName}` : 'Candidatura'))

  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | null>(null)
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null)
  const [adminNotesDraft, setAdminNotesDraft] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [isRelinkConfirmOpen, setIsRelinkConfirmOpen] = useState(false)
  const [isApprovalConfirmOpen, setIsApprovalConfirmOpen] = useState(false)
  const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false)
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false)
  const [isStatusInfoOpen, setIsStatusInfoOpen] = useState(false)

  const currentStatus = selectedStatus ?? app?.status ?? 'pending'
  const formattedCreatedAt = useMemo(() => tsToDate(app?.createdAt), [app?.createdAt])
  const formattedUpdatedAt = useMemo(() => tsToDate(app?.updatedAt), [app?.updatedAt])
  const adminNotes = adminNotesDraft ?? app?.adminNotes ?? ''
  const isGeneralInterest = app ? isGeneralInterestApplication(app) : false
  const currentAnimalId = selectedAnimalId ?? app?.animalId ?? ''

  // Campos PII nunca lidos direto do Firestore — sempre via CF getApplicationPII
  const phone = pii?.phone ?? ''
  const whatsAppHref = piiLoading ? null : getWhatsAppHref(phone)

  const {
    data: linkableAnimals = [],
    isLoading: linkableAnimalsLoading,
  } = useQuery({
    queryKey: [
      'animals',
      'linkable-application',
      app?.id,
      app?.species,
      app?.preferredSex,
      app?.preferredSize,
    ],
    queryFn: () => getLinkableAnimalsForApplication({
      species: app!.species,
      preferredSex: app!.preferredSex,
      preferredSize: app!.preferredSize,
    }),
    enabled: Boolean(app) && isGeneralInterest,
    staleTime: 1000 * 60 * 5,
  })

  const animalOptions = useMemo(() => {
    if (!app || !isGeneralInterest) return []

    const options = linkableAnimals.map((animal) => ({
      value: animal.id,
      label: buildLinkableAnimalLabel(animal),
    }))

    if (app.animalId) {
      options.unshift({
        value: app.animalId,
        label: `${app.animalName ?? 'Animal vinculado'} · vínculo atual`,
      })
    }

    const seen = new Set<string>()
    return options.filter((option) => {
      if (seen.has(option.value)) return false
      seen.add(option.value)
      return true
    })
  }, [app, isGeneralInterest, linkableAnimals])

  const selectedAnimalName = useMemo(
    () =>
      animalOptions.find((option) => option.value === currentAnimalId)?.label
      ?? app?.animalName
      ?? 'Animal vinculado',
    [animalOptions, app?.animalName, currentAnimalId],
  )

  const approvalAnimalId = currentStatus === 'approved' ? (app?.animalId ?? currentAnimalId) : null

  const { data: affectedCandidates = [] } = useQuery({
    queryKey: ['applications', 'active-for-animal', approvalAnimalId, id],
    queryFn: () => getActiveApplicationsForAnimal(approvalAnimalId!, id!),
    enabled: Boolean(approvalAnimalId && id),
    staleTime: 1000 * 60 * 5,
  })

  const needsRelinkConfirmation = Boolean(
    isGeneralInterest &&
    app?.animalId &&
    currentAnimalId &&
    currentAnimalId !== app.animalId &&
    app.status !== 'pending',
  )

  function saveReview() {
    if (!id) return
    setSaveError(null)
    updateReview(
      {
        id,
        status: currentStatus,
        adminNotes,
        ...(isGeneralInterest && currentAnimalId
          ? {
            animalId: currentAnimalId,
            animalName: selectedAnimalName,
          }
          : {}),
      },
      {
        onSuccess: () => {
          setSelectedAnimalId(null)
          setSaved(true)
          setSavedMessage(
            currentStatus === 'approved' && affectedCandidates.length > 0
              ? `Adoção confirmada · ${affectedCandidates.length} candidato${affectedCandidates.length !== 1 ? 's' : ''} convertido${affectedCandidates.length !== 1 ? 's' : ''} para interesse geral`
              : null,
          )
          if (currentStatus !== 'approved' || affectedCandidates.length === 0) {
            setTimeout(() => setSaved(false), 3000)
          }
        },
        onError: (mutationError) => {
          setSaveError(getReviewErrorMessage(mutationError))
        },
      },
    )
  }

  function handleSave() {
    if (isGeneralInterest && currentStatus === 'approved' && !currentAnimalId) {
      setSaveError('Vincule um animal antes de aprovar esta candidatura.')
      return
    }

    if (currentStatus === 'approved' && currentAnimalId) {
      setIsApprovalConfirmOpen(true)
      return
    }

    if (needsRelinkConfirmation) {
      setIsRelinkConfirmOpen(true)
      return
    }

    saveReview()
  }

  function handleDecline() {
    if (!id) return
    setSaveError(null)
    updateReview(
      { id, status: 'declined' },
      {
        onSuccess: () => navigate('/admin/candidaturas'),
        onError: (e) => {
          setIsRejectionModalOpen(false)
          setSaveError(getReviewErrorMessage(e))
        },
      },
    )
  }

  function handleReject(reason: RejectionReason, details: string) {
    if (!id) return
    setSaveError(null)
    updateReview(
      { id, status: 'rejected', rejectionReason: reason, rejectionDetails: details },
      {
        onSuccess: () => {
          setIsRejectionModalOpen(false)
          setSaved(true)
          setSavedMessage('Rejeição registrada. Será arquivada no ciclo semanal.')
        },
        onError: (e) => setSaveError(getReviewErrorMessage(e)),
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

  const canBeRejected = app.status === 'pending' || app.status === 'in_review'
  const isTerminalStatus = app.status === 'rejected'

  const hasSpecificAnimal = Boolean(app.animalId)
  const animalLabel = hasSpecificAnimal ? app.animalName ?? 'Animal vinculado' : 'Interesse geral'
  const animalHelper = !isGeneralInterest
    ? SPECIES_LABELS[app.species]
    : app.species === 'dog'
      ? `Sexo: ${formatPreferenceLabel(app.preferredSex, SEX_LABELS)} · Porte: ${formatPreferenceLabel(app.preferredSize, SIZE_LABELS)}`
      : [
        app.preferredSex ? `Sexo: ${formatPreferenceLabel(app.preferredSex, SEX_LABELS)}` : null,
        app.jointAdoption !== undefined ? `Adoção conjunta: ${app.jointAdoption ? 'Sim' : 'Não'}` : null,
      ].filter(Boolean).join(' · ') || '—'
  const hasLinkableOptions = animalOptions.length > 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <AnimalQuickViewModal
        animalId={app.animalId}
        animalName={app.animalName}
        open={isAnimalModalOpen}
        onClose={() => setIsAnimalModalOpen(false)}
      />

      <ConfirmModal
        open={isApprovalConfirmOpen}
        onClose={() => setIsApprovalConfirmOpen(false)}
        onConfirm={() => {
          setIsApprovalConfirmOpen(false)
          saveReview()
        }}
        title="Confirmar adoção?"
        description={
          affectedCandidates.length > 0
            ? `${affectedCandidates.length} candidato${affectedCandidates.length !== 1 ? 's' : ''} aguardando ${app.animalName ?? 'este animal'} ${affectedCandidates.length !== 1 ? 'serão convertidos' : 'será convertido'} para interesse geral:`
            : `Nenhum outro candidato aguarda ${app.animalName ?? 'este animal'}.`
        }
        confirmLabel="Aprovar e converter"
        cancelLabel="Cancelar"
        variant="warning"
        loading={isPending}
      >
        {affectedCandidates.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1.5">
            {affectedCandidates.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                <span className="text-muted-foreground">#{c.queuePosition}</span>
                {c.fullName}
              </li>
            ))}
          </ul>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={isRelinkConfirmOpen}
        onClose={() => setIsRelinkConfirmOpen(false)}
        onConfirm={() => {
          setIsRelinkConfirmOpen(false)
          saveReview()
        }}
        title="Trocar o animal vinculado?"
        description="Essa candidatura já saiu do estado pendente. Ao trocar o animal, o status do animal antigo e do novo será recalculado."
        confirmLabel="Trocar animal"
        cancelLabel="Cancelar"
        variant="warning"
        loading={isPending}
      />

      <RejectionModal
        open={isRejectionModalOpen}
        onClose={() => setIsRejectionModalOpen(false)}
        onDecline={handleDecline}
        onReject={handleReject}
        loading={isPending}
      />

      <Card className="border-border/80 p-6">
        <Link
          to="/admin/candidaturas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Voltar para Candidaturas
        </Link>

        <div className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-foreground">{app.fullName}</h1>
            <div className="flex justify-end shrink-0">
              <ApplicationStatusBadge status={app.status} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 w-full sm:grid-cols-2 lg:grid-cols-3 lg:w-fit lg:mx-auto">
            <SummaryCard
              icon={PawPrint}
              label={!isGeneralInterest ? 'Animal' : hasSpecificAnimal ? 'Animal vinculado' : 'Busca'}
              value={animalLabel}
              helper={app.previousAnimalName ? `Inscreveu-se para ${app.previousAnimalName} · adotado` : animalHelper}
              onClick={hasSpecificAnimal ? () => setIsAnimalModalOpen(true) : undefined}
            />
            <SummaryCard
              icon={Mail}
              label="Contato"
              value={app.email}
              valueHref={`mailto:${app.email}`}
              valueIcon={<Mail size={14} />}
              helper={piiLoading ? '•••' : phone}
              helperHref={whatsAppHref}
              helperIcon={<MessageCircle size={14} />}
            />
            <SummaryCard
              icon={CalendarClock}
              label="Última atualização"
              value={formattedUpdatedAt}
              helper={`Recebida em ${formattedCreatedAt}`}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6">
          {/* Duas colunas com controle explícito */}
          <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start">
            {/* Coluna esquerda */}
            <div className="flex flex-col gap-6 min-w-0 flex-1">
              {/* Step 1: Identificação */}
              <DetailSection title="Identificação">
                <DetailField label="Nome completo" value={app.fullName} />
                <DetailField label="CPF" value={piiLoading ? '•••' : (pii?.cpf || undefined)} />
                <ContactField
                  label="E-mail"
                  value={app.email}
                  href={`mailto:${app.email}`}
                  actionLabel="Enviar e-mail"
                  icon={<Mail size={14} />}
                />
                <ContactField
                  label="Telefone"
                  value={piiLoading ? '•••' : phone}
                  href={whatsAppHref}
                  actionLabel="Abrir WhatsApp"
                  icon={<MessageCircle size={14} />}
                />
                <DetailField
                  label="Data de nascimento"
                  value={piiLoading ? '•••' : formatDate(pii?.birthDate ?? '')}
                />
                <DetailField label="CEP" value={app.cep || undefined} />
                <div className="sm:col-span-2">
                  <DetailField
                    label="Endereço"
                    value={
                      piiLoading
                        ? '•••'
                        : pii?.address
                          ? `${pii.address.street}, ${pii.address.number}${pii.address.complement ? ` ${pii.address.complement}` : ''} — ${pii.address.neighborhood ? `${pii.address.neighborhood}, ` : ''}${pii.address.city}/${pii.address.state}`
                          : '—'
                    }
                  />
                </div>
              </DetailSection>

              {/* Step 2: Preferências */}
              {isGeneralInterest && (
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
                    <>
                      <DetailField label="Sexo preferido" value={formatPreferenceLabel(app.preferredSex, SEX_LABELS)} />
                      <DetailField label="Adoção conjunta" value={<Bool value={app.jointAdoption} />} />
                    </>
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
            </div>

            {/* Coluna direita */}
            <div className="flex flex-col gap-6 min-w-0 flex-1">
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
            </div>
          </div>

          {/* Step 7: Compromisso — full width */}
          <DetailSection title="Compromisso">
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

          {/* Step 8: Termos — full width */}
          <DetailSection title="Termos aceitos">
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
          {flagResult?.flagged && (
            <div className="rounded-lg border border-warning/30 bg-warning/8 p-4 flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-warning">
                Alerta: solicitante com histórico de rejeição
              </p>
              <p className="text-xs text-muted-foreground">
                {flagResult.rejectionCount > 1
                  ? `Este CPF possui ${flagResult.rejectionCount} rejeições definitivas registradas.`
                  : 'Este CPF possui 1 rejeição definitiva registrada.'}
                {flagResult.reason ? ` Último motivo: ${flagResult.reason}.` : ''}
                {' '}Decida com contexto — o bloqueio automático não é aplicado.
              </p>
            </div>
          )}

          <Card className="border-border/80 p-5">
            <div className="flex items-center gap-2">
              <HeartHandshake size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Triagem</h2>
            </div>

            {isTerminalStatus ? (
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 flex flex-col gap-2">
                  <p className="text-xs font-medium text-danger uppercase tracking-wide">
                    {app.rejectionReason
                      ? REJECTION_REASON_LABELS[app.rejectionReason]
                      : 'Rejeição definitiva'}
                  </p>
                  {app.rejectionDetails && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{app.rejectionDetails}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  No próximo ciclo semanal: PDF gerado, arquivado no Drive e removido do sistema.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Status</span>
                      <button
                        type="button"
                        onClick={() => setIsStatusInfoOpen((v) => !v)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        aria-expanded={isStatusInfoOpen}
                      >
                        <Info size={13} />
                        {isStatusInfoOpen ? 'Fechar' : 'O que significa cada status?'}
                      </button>
                    </div>
                    {isStatusInfoOpen && (
                      <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground flex flex-col gap-1.5">
                        <p><strong className="text-foreground">Pendente</strong> — recebido, aguardando triagem</p>
                        <p><strong className="text-foreground">Em análise</strong> — em avaliação ativa pela equipe</p>
                        <p><strong className="text-foreground">Aprovada</strong> — adoção confirmada · PDF gerado e arquivado em 30 dias</p>
                        <p><strong className="text-foreground">Retirada</strong> — candidato desistiu · removido automaticamente em 30 dias</p>
                        <p><strong className="text-foreground">Recusar candidatura</strong> — use o botão abaixo para declinar (sem registro) ou rejeitar definitivamente (com alerta permanente)</p>
                      </div>
                    )}
                    <Select
                      options={APPLICATION_STATUS_OPTIONS}
                      value={currentStatus}
                      onChange={(value) => setSelectedStatus(value as ApplicationStatus)}
                    />
                  </div>

                  {isGeneralInterest && (
                    <Select
                      label="Vincular animal"
                      options={animalOptions}
                      value={currentAnimalId || undefined}
                      onChange={(value) => setSelectedAnimalId(value)}
                      placeholder={
                        linkableAnimalsLoading
                          ? 'Carregando animais compatíveis…'
                          : 'Selecione um animal compatível'
                      }
                      hint={
                        hasLinkableOptions
                          ? 'Só aparecem animais disponíveis que combinam com as preferências desta candidatura.'
                          : 'Nenhum animal disponível corresponde a esta candidatura no momento.'
                      }
                      disabled={linkableAnimalsLoading || (!hasLinkableOptions && !currentAnimalId)}
                    />
                  )}

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
                  {canBeRejected && (
                    <Button
                      variant="outline"
                      className="w-full text-danger border-danger/30 hover:bg-danger/5"
                      onClick={() => setIsRejectionModalOpen(true)}
                      disabled={isPending}
                    >
                      Recusar candidatura
                    </Button>
                  )}
                  {saveError && (
                    <span className="text-sm text-danger">{saveError}</span>
                  )}
                  {saved && (
                    <span className="text-sm text-success">
                      {savedMessage ?? 'Salvo com sucesso.'}
                    </span>
                  )}
                </div>
              </>
            )}
          </Card>

          <Card className="border-border/80 p-5">
            <h2 className="text-sm font-semibold text-foreground">Resumo rápido</h2>
            <div className="mt-4 flex flex-col gap-4">
              <SidebarField label="Status atual do formulário" value={<ApplicationStatusBadge status={app.status} />} />
              <SidebarField
                label={!isGeneralInterest ? 'Animal' : hasSpecificAnimal ? 'Animal vinculado' : 'Busca'}
                value={
                  !isGeneralInterest
                    ? `${animalLabel} (${SPECIES_LABELS[app.species]})`
                    : `${animalLabel} · ${animalHelper}`
                }
              />
              <SidebarField
                label="Posição na fila"
                value={
                  app.queuePosition && app.queuePosition > 1
                    ? `#${app.queuePosition}º`
                    : app.waitlistEntry
                      ? 'Na fila'
                      : '—'
                }
              />
              {app.previousAnimalName && (
                <SidebarField
                  label="Animal original"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Info size={12} className="shrink-0 text-muted-foreground" />
                      {app.previousAnimalName} · adotado
                    </span>
                  }
                />
              )}
              <SidebarField label="Recebida em" value={formattedCreatedAt} />
              <SidebarField label="Última atualização" value={formattedUpdatedAt} />
              <SidebarField label="Contato" value={`${app.email} · ${piiLoading ? '•••' : (pii?.phone ?? '—')}`} />
            </div>
          </Card>

          <TraceabilityCard
            title="Rastreabilidade da revisão"
            rows={[
              { label: 'Status atual', value: <ApplicationStatusBadge status={app.status} /> },
              {
                label: 'Ação da revisão',
                value: app.reviewAction ? APPLICATION_STATUS_LABELS[app.reviewAction] : undefined,
              },
              { label: 'Revisado em', value: formatTraceDate(app.reviewedAt) },
              { label: 'Revisado por', value: formatActorLabel(app.reviewedByLabel) },
              { label: 'Última atualização', value: formatTraceDate(app.updatedAt) },
              { label: 'Atualizado por', value: formatActorLabel(app.updatedByLabel) },
            ]}
          />
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
  onClick,
  valueHref,
  helperHref,
  valueIcon,
  helperIcon,
}: {
  icon: LucideIcon
  label: string
  value: string
  helper?: string
  onClick?: () => void
  valueHref?: string
  helperHref?: string | null
  valueIcon?: React.ReactNode
  helperIcon?: React.ReactNode
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'rounded-xl border border-border bg-muted/25 p-4 text-left',
        onClick && 'cursor-pointer transition-colors hover:bg-muted/50 hover:border-border/60',
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      {valueHref ? (
        <a href={valueHref} target={valueHref.startsWith('https://') ? '_blank' : undefined} rel={valueHref.startsWith('https://') ? 'noopener noreferrer' : undefined} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors">
          {valueIcon}{value}
        </a>
      ) : (
        <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
      )}
      {helper && (
        helperHref ? (
          <a href={helperHref} target={helperHref.startsWith('https://') ? '_blank' : undefined} rel={helperHref.startsWith('https://') ? 'noopener noreferrer' : undefined} className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            {helperIcon}{helper}
          </a>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        )
      )}
    </Comp>
  )
}

function ContactField({
  label,
  value,
  href,
  icon,
}: {
  label: string
  value: string
  href: string | null
  actionLabel: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target={href.startsWith('https://') ? '_blank' : undefined}
          rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center gap-1.5 text-sm text-foreground transition-colors hover:text-primary wrap-break-words"
        >
          {icon}
          {value}
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground wrap-break-words">
          {icon}
          {value}
        </span>
      )}
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
