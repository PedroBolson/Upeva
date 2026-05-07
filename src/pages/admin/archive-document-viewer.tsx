import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, FileText, RefreshCw } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { useAdminPageHeader } from '@/features/admin/hooks/use-admin-header'
import { useArchiveDocumentUrl } from '@/features/admin/hooks/use-archive-files'
import { buildAdminTitle, useDocumentTitle } from '@/utils/page-title'

type ViewerLocationState = {
  backTo?: string
}

const SIGNED_URL_VISIBLE_MS = 9 * 60 * 1000
const headerLinkClassName =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm'

export function ArchiveDocumentViewerPage() {
  useDocumentTitle(buildAdminTitle('Arquivo PDF'))
  const { archiveFileId } = useParams<{ archiveFileId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as ViewerLocationState | null
  const backTo = state?.backTo?.startsWith('/admin') ? state.backTo : '/admin/arquivos'

  const {
    data: url,
    dataUpdatedAt,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useArchiveDocumentUrl(archiveFileId)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!url) return
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [url])

  const isExpired = Boolean(dataUpdatedAt && now > 0 && now - dataUpdatedAt >= SIGNED_URL_VISIBLE_MS)
  const viewerUrl = useMemo(() => url ?? '', [url])

  const handleBack = useCallback(() => {
    navigate(backTo)
  }, [backTo, navigate])

  const handleRetry = useCallback(() => {
    setNow(Date.now())
    void refetch()
  }, [refetch])

  const headerActions = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="sm" className="shrink-0 gap-1.5" onClick={handleBack}>
          <ArrowLeft size={14} />
          Voltar
        </Button>

        {viewerUrl && !isExpired && (
          <div className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto overscroll-contain py-1">
            <a
              href={viewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={headerLinkClassName}
            >
              <ExternalLink size={14} />
              Abrir arquivo
            </a>
            <div className="hidden shrink-0 md:block">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={handleRetry}
                disabled={isFetching}
              >
                <RefreshCw size={14} className={isFetching ? 'animate-spin' : undefined} />
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
      </div>
    ),
    [handleBack, handleRetry, isExpired, isFetching, viewerUrl],
  )

  useAdminPageHeader(useMemo(() => ({ actions: headerActions }), [headerActions]))

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[32rem] w-full flex-col gap-2 overflow-hidden lg:h-[calc(100dvh-8rem)]">
      {viewerUrl && !isExpired && (
        <div className="shrink-0 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground md:hidden">
          <span>
            Se o PDF não abrir corretamente neste dispositivo, toque em Abrir arquivo. Se continuar falhando,{' '}
          </span>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isFetching}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : undefined} />
            tente novamente
          </button>
          <span>.</span>
        </div>
      )}

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {isLoading && <DocumentViewerLoadingState />}

        {!isLoading && (isError || !archiveFileId) && (
          <DocumentViewerErrorState
            message="Não foi possível carregar este documento. Verifique sua permissão ou tente novamente."
            onRetry={handleRetry}
            onBack={handleBack}
            retrying={isFetching}
          />
        )}

        {!isLoading && !isError && isExpired && (
          <DocumentViewerErrorState
            message="O link expirou. Gere um novo acesso ao documento."
            onRetry={handleRetry}
            onBack={handleBack}
            retrying={isFetching}
          />
        )}

        {!isLoading && !isError && viewerUrl && !isExpired && (
          <PdfViewer url={viewerUrl} />
        )}
      </main>
    </div>
  )
}

export function PdfViewer({ url }: { url: string }) {
  return (
    <Card className="flex min-h-0 flex-1 overflow-hidden border-border/80 p-0 shadow-sm">
      <iframe
        title="Arquivo PDF"
        src={url}
        className="h-full w-full border-0 bg-background"
      />
    </Card>
  )
}

export function DocumentViewerLoadingState() {
  return (
    <Card className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 border-border/80 p-8 text-center">
      <Spinner size="md" />
      <p className="text-sm text-muted-foreground">Carregando PDF...</p>
    </Card>
  )
}

export function DocumentViewerErrorState({
  message,
  onRetry,
  onBack,
  retrying,
}: {
  message: string
  onRetry: () => void
  onBack: () => void
  retrying?: boolean
}) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 border-border/80 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileText size={22} />
      </div>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" className="gap-1.5" onClick={onRetry} disabled={retrying}>
          <RefreshCw size={14} className={retrying ? 'animate-spin' : undefined} />
          Tentar novamente
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </Card>
  )
}
