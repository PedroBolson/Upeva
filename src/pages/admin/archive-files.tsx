import { useState } from 'react'
import { Archive, ExternalLink } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/error-state'
import { buildAdminTitle, useDocumentTitle } from '@/utils/page-title'
import {
  useArchiveFiles,
  useGetArchiveFileUrl,
} from '@/features/admin/hooks/use-archive-files'
import type { ArchiveFileType } from '@/features/admin/services/archive.service'

const TYPE_LABELS: Record<ArchiveFileType, string> = {
  contract: 'Contrato de Adoção',
  rejection: 'Rejeição Definitiva',
  archivedAnimal: 'Arquivamento de Animal',
}

const TYPE_OPTIONS: { value: ArchiveFileType | ''; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'contract', label: 'Contratos' },
  { value: 'rejection', label: 'Rejeições' },
  { value: 'archivedAnimal', label: 'Arquivamentos de animais' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatArchiveDate(value: unknown): string {
  if (!value) return '—'
  const ts = value as { seconds?: number }
  if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString('pt-BR')
  return '—'
}

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - i)

export function ArchiveFilesPage() {
  useDocumentTitle(buildAdminTitle('Arquivos'))

  const [typeFilter, setTypeFilter] = useState<ArchiveFileType | ''>('')
  const [yearFilter, setYearFilter] = useState<number | ''>('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const { data: files = [], isLoading, error, refetch } = useArchiveFiles({
    type: typeFilter || null,
    year: yearFilter || null,
  })

  const { mutate: fetchUrl } = useGetArchiveFileUrl()

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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Card className="border-border/80 p-5">
        <div className="flex items-start gap-3">
          <Archive size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Arquivos PDF</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              PDFs gerados automaticamente pelo sistema de arquivamento: contratos de adoção,
              registros de rejeição definitiva e arquivamentos de animais. Os arquivos são
              armazenados em Storage privado e acessíveis somente por links temporários.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ArchiveFileType | '')}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : '')}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">Todos os anos</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      )}

      {error && (
        <ErrorState description="Não foi possível carregar os arquivos." onRetry={refetch} />
      )}

      {!isLoading && !error && files.length === 0 && (
        <Card className="border-border/80 p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum arquivo encontrado.</p>
        </Card>
      )}

      {!isLoading && !error && files.length > 0 && (
        <Card className="border-border/80 divide-y divide-border">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">
                    {file.fileName}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">
                    {TYPE_LABELS[file.type] ?? file.type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{file.year}</span>
                  {file.animalName && <span>{file.animalName}</span>}
                  {file.reviewerLabel && <span>Responsável: {file.reviewerLabel}</span>}
                  <span>{formatBytes(file.sizeBytes)}</span>
                  <span>Arquivado em {formatArchiveDate(file.createdAt)}</span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1.5 text-primary"
                onClick={() => handleOpenPdf(file.id)}
                disabled={openingId === file.id}
              >
                {openingId === file.id ? (
                  <Spinner size="sm" />
                ) : (
                  <ExternalLink size={14} />
                )}
                Abrir PDF
              </Button>
            </div>
          ))}
        </Card>
      )}

      {urlError && (
        <p role="alert" className="text-sm text-danger">{urlError}</p>
      )}
    </div>
  )
}
