import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { AlertTriangle, ExternalLink, Trash2 } from 'lucide-react'
import { db } from '@/lib/firebase'
import { Button, Card } from '@/components/ui'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { useDeleteRejectionFlag } from '@/features/adoption/hooks/use-rejection-flag'
import { useGetArchiveFileUrl } from '@/features/admin/hooks/use-archive-files'
import { buildAdminTitle, useDocumentTitle } from '@/utils/page-title'

type RejectionFlag = {
  id: string
  reason: string | null
  rejectionCount: number
  rejectedAt: unknown
  archiveFileId?: string
}

const REASON_LABELS: Record<string, string> = {
  inadequate_housing: 'Moradia inadequada',
  no_landlord_permission: 'Sem autorização do proprietário',
  financial_instability: 'Instabilidade financeira',
  previous_animal_negligence: 'Histórico de negligência com animais',
  incompatible_lifestyle: 'Estilo de vida incompatível',
  other: 'Outro',
}

function formatFlagDate(value: unknown): string {
  if (!value) return '—'
  const ts = value as { seconds?: number }
  if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString('pt-BR')
  return '—'
}

export function RejectionFlagsPage() {
  useDocumentTitle(buildAdminTitle('Alertas de Rejeição'))

  const [flagToDelete, setFlagToDelete] = useState<RejectionFlag | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const { data: flags = [], isLoading, error, refetch } = useQuery({
    queryKey: ['rejection-flags'],
    queryFn: async (): Promise<RejectionFlag[]> => {
      const snap = await getDocs(
        query(collection(db, 'rejectionFlags'), orderBy('rejectedAt', 'desc')),
      )
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          reason: (data.reason as string) ?? null,
          rejectionCount: (data.rejectionCount as number) ?? 1,
          rejectedAt: data.rejectedAt ?? null,
          archiveFileId: data.archiveFileId as string | undefined,
        }
      })
    },
    staleTime: 1000 * 60 * 2,
  })

  const { mutate: deleteFlag, isPending: isDeleting } = useDeleteRejectionFlag()
  const { mutate: fetchUrl } = useGetArchiveFileUrl()

  function handleConfirmDelete() {
    if (!flagToDelete) return
    setDeleteError(null)
    deleteFlag(flagToDelete.id, {
      onSuccess: () => {
        setFlagToDelete(null)
        refetch()
      },
      onError: () => {
        setFlagToDelete(null)
        setDeleteError('Não foi possível remover o alerta. Tente novamente.')
      },
    })
  }

  function handleOpenPdf(archiveFileId: string) {
    setUrlError(null)
    setOpeningId(archiveFileId)
    fetchUrl(archiveFileId, {
      onSuccess: (url) => {
        setOpeningId(null)
        window.open(url, '_blank', 'noopener,noreferrer')
      },
      onError: () => {
        setOpeningId(null)
        setUrlError('Não foi possível gerar o link do PDF. Tente novamente.')
      },
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <ConfirmModal
        open={flagToDelete !== null}
        onClose={() => setFlagToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Remover alerta de rejeição?"
        description="Esta ação é permanente e não pode ser desfeita. Use apenas em atendimento a pedido de direito ao esquecimento (LGPD Art. 18)."
        confirmLabel="Remover alerta"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isDeleting}
      />

      <Card className="border-border/80 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Alertas de Rejeição</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              CPFs com rejeições definitivas registradas. Estes alertas são exibidos na tela de
              candidatura quando um CPF flagado solicita adoção novamente.
              Dados armazenados como hashes — o CPF original não é recuperável por esta tela.
            </p>
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      )}

      {error && (
        <ErrorState description="Não foi possível carregar os alertas." onRetry={refetch} />
      )}

      {!isLoading && !error && flags.length === 0 && (
        <Card className="border-border/80 p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum alerta de rejeição registrado.</p>
        </Card>
      )}

      {!isLoading && !error && flags.length > 0 && (
        <Card className="border-border/80 divide-y divide-border">
          {flags.map((flag) => (
            <div key={flag.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-warning" />
                  <span className="text-sm font-medium text-foreground font-mono truncate">
                    {flag.id.slice(0, 16)}…
                  </span>
                  {flag.rejectionCount > 1 && (
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                      {flag.rejectionCount}× rejeitado
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {flag.reason && (
                    <span>{REASON_LABELS[flag.reason] ?? flag.reason}</span>
                  )}
                  <span>Registrado em {formatFlagDate(flag.rejectedAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {flag.archiveFileId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground hover:text-primary"
                    onClick={() => handleOpenPdf(flag.archiveFileId!)}
                    disabled={openingId === flag.archiveFileId}
                    aria-label="Abrir PDF de rejeição"
                  >
                    {openingId === flag.archiveFileId ? (
                      <Spinner size="sm" />
                    ) : (
                      <ExternalLink size={14} />
                    )}
                    PDF
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-danger"
                  aria-label="Remover alerta"
                  onClick={() => {
                    setDeleteError(null)
                    setFlagToDelete(flag)
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {deleteError && (
        <p role="alert" className="text-sm text-danger">{deleteError}</p>
      )}
      {urlError && (
        <p role="alert" className="text-sm text-danger">{urlError}</p>
      )}
    </div>
  )
}
