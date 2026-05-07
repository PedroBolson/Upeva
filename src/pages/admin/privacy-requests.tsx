import { useMemo, useState } from 'react'
import { AlertTriangle, DatabaseZap, FileText, Flag, Search, ShieldCheck, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  Input,
  MaskedInput,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui'
import { AdminHeaderOverflow } from '@/features/admin/components/admin-header-overflow'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useHeaderCompaction } from '@/features/admin/hooks/use-header-compaction'
import { getRejectionReasonLabel } from '@/features/adoption/config/rejection-reason-labels'
import {
  useDeletePrivacyApplicationData,
  useDeletePrivacyArchiveFile,
  useDeletePrivacyRejectionFlag,
  usePrivacyBackfill,
  usePrivacyPreview,
} from '@/features/admin/hooks/use-privacy-requests'
import { buildAdminTitle, useDocumentTitle } from '@/utils/page-title'
import type {
  PrivacyBackfillResult,
  PrivacyPreview,
  PrivacyPreviewApplication,
  PrivacyPreviewArchiveFile,
  PrivacyPreviewRejectionFlag,
  PrivacySearchType,
} from '@/features/admin/services/privacy.service'

type DeleteTarget =
  | { kind: 'application'; item: PrivacyPreviewApplication }
  | { kind: 'flag'; item: PrivacyPreviewRejectionFlag }
  | { kind: 'archive'; item: PrivacyPreviewArchiveFile }

const SEARCH_OPTIONS = [
  { value: 'cpf', label: 'CPF' },
  { value: 'email', label: 'E-mail' },
]

const ARCHIVE_TYPE_LABELS: Record<string, string> = {
  contract: 'Contrato de adoção',
  rejection: 'Rejeição definitiva',
  archivedAnimal: 'Animal arquivado',
}

function formatDate(value: unknown): string {
  if (!value) return '-'
  const ts = value as { seconds?: number }
  if (typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000).toLocaleDateString('pt-BR')
  }
  return '-'
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusLabel(status: string | null): string {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    in_review: 'Em análise',
    approved: 'Aprovada',
    rejected: 'Rejeitada',
    withdrawn: 'Desistência',
    declined: 'Declinada',
  }
  return status ? labels[status] ?? status : '-'
}

function EmptyPreviewState() {
  return (
    <Card className="border-border/80 p-8 text-center">
      <p className="text-sm text-muted-foreground">Nenhum registro relacionado encontrado.</p>
    </Card>
  )
}

function TargetSummary({ target }: { target: DeleteTarget }) {
  if (target.kind === 'application') {
    return (
      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
        <p className="font-medium text-foreground">Candidatura {target.item.id}</p>
        <p className="text-muted-foreground">
          {statusLabel(target.item.status)} · {target.item.animalName ?? 'Sem animal vinculado'}
        </p>
      </div>
    )
  }

  if (target.kind === 'flag') {
    return (
      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
        <p className="font-medium text-foreground">Flag de rejeição</p>
        <p className="text-muted-foreground">
          {target.item.reason ? getRejectionReasonLabel(target.item.reason) : 'Sem motivo registrado'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium text-foreground">{target.item.fileName ?? 'Arquivo arquivado'}</p>
      <p className="text-muted-foreground">
        {target.item.type ? ARCHIVE_TYPE_LABELS[target.item.type] ?? target.item.type : 'Arquivo'} · {formatBytes(target.item.sizeBytes)}
      </p>
    </div>
  )
}

function targetWarnings(target: DeleteTarget): string[] {
  if (target.kind === 'application') {
    const warnings = [
      'Esta ação remove somente os dados operacionais da candidatura.',
      'Ela não remove animais, fotos, flags de rejeição nem PDFs arquivados.',
    ]
    if (target.item.status === 'pending' || target.item.status === 'in_review') {
      warnings.push('A candidatura está ativa e a pessoa pode sair da fila.')
    }
    if (target.item.status === 'approved') {
      warnings.push('A candidatura está aprovada; o contrato arquivado permanece até exclusão separada.')
    }
    return warnings
  }

  if (target.kind === 'flag') {
    return [
      'Esta ação remove apenas a flag anônima de rejeição.',
      'Ela não exclui PDF de rejeição arquivado; selecione o arquivo separadamente se necessário.',
    ]
  }

  return [
    'Esta ação excluirá permanentemente o PDF privado e o registro de arquivo arquivado.',
    'Se a candidatura ou o animal original já tiverem sido removidos pelo prazo de retenção, este contrato não poderá ser recuperado pelo sistema.',
    'Esta ação não altera status de candidatura ou animal.',
  ]
}

function DeleteConfirmationModal({
  target,
  loading,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget | null
  loading: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')

  if (!target) return null

  const canConfirm = reason.trim().length >= 10 && confirmation === 'EXCLUIR'
  const title =
    target.kind === 'application' ? 'Excluir dados da candidatura?' :
      target.kind === 'flag' ? 'Excluir flag de rejeição?' :
        'Excluir arquivo arquivado?'

  return (
    <ConfirmModal
      open
      onClose={onClose}
      onConfirm={() => onConfirm(reason)}
      title={title}
      description="Esta operação é permanente e será registrada em auditoria interna segura."
      confirmLabel="Excluir"
      cancelLabel="Cancelar"
      variant="danger"
      loading={loading}
      confirmDisabled={!canConfirm}
    >
      <div className="flex flex-col gap-4">
        <TargetSummary target={target} />

        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {targetWarnings(target).map((warning) => (
            <li key={warning} className="flex gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>

        <Textarea
          label="Justificativa"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          hint="Não informe números, e-mail, telefone, endereço ou outros dados pessoais."
          disabled={loading}
        />
        <Input
          label="Digite EXCLUIR para confirmar"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Informe uma justificativa com ao menos 10 caracteres e confirme com EXCLUIR.
        </p>
      </div>
    </ConfirmModal>
  )
}

function BackfillConfirmModal({
  open,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean
  loading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Atualizar índices de privacidade?"
      description="Esta ação processa candidaturas antigas para permitir a busca por CPF/e-mail na tela de privacidade. Ela não altera status, não envia mensagens e não modifica o conteúdo da candidatura, mas pode gerar leituras e escritas no Firebase. Execute apenas quando não encontrar dados do CPF requisitado."
      confirmLabel="Atualizar índices"
      cancelLabel="Cancelar"
      variant="warning"
      loading={loading}
    >
      <p className="text-sm text-muted-foreground">
        Novas candidaturas já recebem esses índices automaticamente.
        <br />
        Se você rodou a atualização após não encontrar um registro, é possivel que não exista registros com o CPF/email informados.
      </p>
    </ConfirmModal>
  )
}

function BackfillResultBanner({ result }: { result: PrivacyBackfillResult }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <DatabaseZap size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {result.hasMore ? 'Índices parcialmente atualizados.' : 'Índices de privacidade atualizados.'}
          </p>
          <p className="text-xs text-muted-foreground">
            Lidos: {result.scannedCount} · Atualizados: {result.updatedCount} · Ignorados: {result.skippedCount} · Falhas: {result.failedCount}
          </p>
          {result.hasMore && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ainda há registros antigos pendentes. Execute novamente para processar o próximo lote.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PreviewSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof FileText
  children: React.ReactNode
}) {
  return (
    <Card className="border-border/80">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </Card>
  )
}

export function PrivacyRequestsPage() {
  useDocumentTitle(buildAdminTitle('Privacidade'))
  const { toast } = useToast()
  const [searchType, setSearchType] = useState<PrivacySearchType>('cpf')
  const [searchValue, setSearchValue] = useState('')
  const [lastSearch, setLastSearch] = useState<{ type: PrivacySearchType; value: string } | null>(null)
  const [preview, setPreview] = useState<PrivacyPreview | null>(null)
  const [target, setTarget] = useState<DeleteTarget | null>(null)
  const [showBackfillConfirm, setShowBackfillConfirm] = useState(false)

  const previewMutation = usePrivacyPreview()
  const backfillMutation = usePrivacyBackfill()
  const deleteApplication = useDeletePrivacyApplicationData()
  const deleteFlag = useDeletePrivacyRejectionFlag()
  const deleteArchive = useDeletePrivacyArchiveFile()
  const deleting = deleteApplication.isPending || deleteFlag.isPending || deleteArchive.isPending

  const { containerRef, measureRef, isCompact } = useHeaderCompaction()
  const { mutate: executePreview, isPending: previewIsPending } = previewMutation
  const { mutate: executeBackfill, isPending: backfillIsPending } = backfillMutation

  const hasPreviewResults = Boolean(
    preview &&
    (preview.applications.length > 0 ||
      preview.rejectionFlags.length > 0 ||
      preview.archiveFiles.length > 0 ||
      preview.warnings.length > 0),
  )

  function runPreview(nextSearch = lastSearch) {
    if (!nextSearch) return
    previewMutation.mutate(nextSearch, {
      onSuccess: (data) => {
        setPreview(data)
        setLastSearch(nextSearch)
      },
      onError: () => {
        toast.error('Não foi possível buscar os registros de privacidade.')
      },
    })
  }

  function handleConfirmDelete(reason: string) {
    if (!target) return

    const common = {
      onSuccess: () => {
        setTarget(null)
        toast.success('Ação de privacidade concluída.')
        runPreview()
      },
      onError: () => {
        toast.error('Não foi possível concluir a ação de privacidade.')
      },
    }

    if (target.kind === 'application') {
      deleteApplication.mutate({ applicationId: target.item.id, reason }, common)
    } else if (target.kind === 'flag') {
      deleteFlag.mutate({ flagId: target.item.flagId, reason }, common)
    } else {
      deleteArchive.mutate({ archiveFileId: target.item.id, reason }, common)
    }
  }

  function handleBackfillConfirm() {
    executeBackfill(undefined, {
      onSuccess: () => {
        setShowBackfillConfirm(false)
      },
      onError: () => {
        setShowBackfillConfirm(false)
        toast.error('Não foi possível atualizar os índices de privacidade.')
      },
    })
  }

  const headerActions = useMemo(() => {
    function onSearchSubmit(event: React.FormEvent, closeOverflow?: () => void) {
      event.preventDefault()
      const trimmed = searchValue.trim()
      if (!trimmed) return
      closeOverflow?.()
      const nextSearch = { type: searchType, value: trimmed }
      executePreview(nextSearch, {
        onSuccess: (data) => {
          setPreview(data)
          setLastSearch(nextSearch)
        },
        onError: () => {
          toast.error('Não foi possível buscar os registros de privacidade.')
        },
      })
    }

    function onTypeChange(value: string) {
      setSearchType(value as PrivacySearchType)
      setSearchValue('')
      setPreview(null)
    }

    const inlineSearchForm = (
      <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
        <div className="w-32 shrink-0">
          <Select
            options={SEARCH_OPTIONS}
            value={searchType}
            onChange={onTypeChange}
            className="h-9 rounded-lg"
            aria-label="Buscar por"
          />
        </div>
        <div className="w-48 shrink-0">
          {searchType === 'cpf' ? (
            <MaskedInput
              mask="cpf"
              placeholder="000.000.000-00"
              value={searchValue}
              onChange={setSearchValue}
              aria-label="CPF"
              className="h-9"
            />
          ) : (
            <Input
              type="email"
              placeholder="nome@email.com"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              aria-label="E-mail"
              className="h-9"
            />
          )}
        </div>
        <Button type="submit" size="sm" className="h-9 shrink-0 gap-1.5" loading={previewIsPending}>
          <Search size={15} />
          Buscar
        </Button>
      </form>
    )

    return (
      <div ref={containerRef} className="relative flex min-w-0 items-center gap-2">
        {/* Invisible measure element to detect overflow */}
        <div
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 inline-flex items-center gap-2 whitespace-nowrap"
        >
          <div className="h-9 w-32 shrink-0" />
          <div className="h-9 w-48 shrink-0" />
          <div className="h-9 w-20 shrink-0" />
          <div className="h-9 w-36 shrink-0" />
        </div>

        {!isCompact && inlineSearchForm}

        {isCompact && (
          <AdminHeaderOverflow label="Buscar" active={Boolean(lastSearch)}>
            {(close) => (
              <form onSubmit={(e) => onSearchSubmit(e, close)} className="flex flex-col gap-3">
                <Select
                  label="Buscar por"
                  options={SEARCH_OPTIONS}
                  value={searchType}
                  onChange={onTypeChange}
                />
                {searchType === 'cpf' ? (
                  <MaskedInput
                    mask="cpf"
                    label="CPF"
                    placeholder="000.000.000-00"
                    value={searchValue}
                    onChange={setSearchValue}
                  />
                ) : (
                  <Input
                    label="E-mail"
                    type="email"
                    placeholder="nome@email.com"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                  />
                )}
                <Button type="submit" className="w-full gap-2" loading={previewIsPending}>
                  <Search size={15} />
                  Buscar
                </Button>
              </form>
            )}
          </AdminHeaderOverflow>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          onClick={() => setShowBackfillConfirm(true)}
          disabled={backfillIsPending}
        >
          <DatabaseZap size={15} />
          Atualizar índices
        </Button>
      </div>
    )
  }, [containerRef, executePreview, isCompact, lastSearch, measureRef, previewIsPending, backfillIsPending, searchType, searchValue, toast])

  useAdminPageHeader(useMemo(() => ({ actions: headerActions }), [headerActions]))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <DeleteConfirmationModal
        key={
          target
            ? `${target.kind}-${target.kind === 'application' ? target.item.id :
              target.kind === 'flag' ? target.item.flagId :
                target.item.id
            }`
            : 'empty'
        }
        target={target}
        loading={deleting}
        onClose={() => setTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <BackfillConfirmModal
        open={showBackfillConfirm}
        loading={backfillIsPending}
        onClose={() => setShowBackfillConfirm(false)}
        onConfirm={handleBackfillConfirm}
      />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Privacidade e LGPD</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Localize registros relacionados a uma solicitação de dados e execute ações administrativas com segurança.
        </p>
      </div>

      {backfillMutation.data && <BackfillResultBanner result={backfillMutation.data} />}

      {previewMutation.isPending && (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      )}

      {!previewMutation.isPending && preview && !hasPreviewResults && <EmptyPreviewState />}

      {!previewMutation.isPending && preview && hasPreviewResults && (
        <div className="flex flex-col gap-4">
          {preview.warnings.length > 0 && (
            <PreviewSection title="Avisos" icon={AlertTriangle}>
              <div className="flex flex-col gap-2 p-4">
                {preview.warnings.map((warning) => (
                  <div key={warning.code} className="flex gap-2 text-sm text-muted-foreground">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
                    <span>{warning.message}</span>
                  </div>
                ))}
              </div>
            </PreviewSection>
          )}

          <PreviewSection title="Candidaturas" icon={FileText}>
            {preview.applications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma candidatura encontrada.</p>
            ) : (
              <div className="divide-y divide-border">
                {preview.applications.map((application) => (
                  <div key={application.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{application.animalName ?? 'Candidatura geral'}</p>
                        <Badge variant="outline">{statusLabel(application.status)}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{application.id}</span>
                        <span>Criada em {formatDate(application.createdAt)}</span>
                        <span>Atualizada em {formatDate(application.updatedAt)}</span>
                        {application.contractArchiveFileId && <span>Contrato vinculado</span>}
                        {application.pendingExport && <span>Exportação pendente</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-danger"
                      onClick={() => setTarget({ kind: 'application', item: application })}
                    >
                      <Trash2 size={14} />
                      Excluir dados da candidatura
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </PreviewSection>

          <PreviewSection title="Flags de rejeição" icon={Flag}>
            {preview.rejectionFlags.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma flag encontrada.</p>
            ) : (
              <div className="divide-y divide-border">
                {preview.rejectionFlags.map((flag) => (
                  <div key={flag.flagId} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">Flag registrada</p>
                        {flag.rejectionCount > 1 && <Badge variant="warning">{flag.rejectionCount} rejeições</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{flag.reason ? getRejectionReasonLabel(flag.reason) : 'Sem motivo'}</span>
                        <span>Registrada em {formatDate(flag.rejectedAt)}</span>
                        {flag.archiveFileId && <span>PDF vinculado</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-danger"
                      onClick={() => setTarget({ kind: 'flag', item: flag })}
                    >
                      <Trash2 size={14} />
                      Excluir flag
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </PreviewSection>

          <PreviewSection title="Arquivos relacionados" icon={FileText}>
            {preview.archiveFiles.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum arquivo relacionado encontrado.</p>
            ) : (
              <div className="divide-y divide-border">
                {preview.archiveFiles.map((file) => (
                  <div key={file.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{file.animalName ?? file.fileName ?? 'Arquivo arquivado'}</p>
                        <Badge variant="outline">{file.type ? ARCHIVE_TYPE_LABELS[file.type] ?? file.type : 'Arquivo'}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{file.fileName?.replace(/\.pdf$/i, '') ?? file.id}</span>
                        <span>{formatBytes(file.sizeBytes)}</span>
                        <span>Ano {file.year ?? '-'}</span>
                        <span>Arquivado em {formatDate(file.createdAt)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-danger"
                      onClick={() => setTarget({ kind: 'archive', item: file })}
                    >
                      <Trash2 size={14} />
                      Excluir arquivo
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </PreviewSection>
        </div>
      )}
    </div>
  )
}
