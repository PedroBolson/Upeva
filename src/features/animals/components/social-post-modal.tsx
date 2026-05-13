import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Download } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'
import { buildAnimalSocialPost, getAnimalAdoptionUrl } from '../utils/social-post'
import { SEX_LABELS, SIZE_LABELS, SPECIES_LABELS } from '../types/animal.types'
import type { Animal } from '../types/animal.types'

// ─── Canvas constants ──────────────────────────────────────────────────────────

const CANVAS_SIZE = 1080
const DARK_RGB = '23, 17, 15'
const BADGE_COLOR = '#d07a38'

// ─── Image loading ─────────────────────────────────────────────────────────────

type PhotoStatus = 'clean' | 'cors_blocked' | 'none'
type DrawResult = { photoStatus: PhotoStatus }

/**
 * Loads a cross-origin image with crossOrigin="anonymous" so the canvas remains
 * untainted and toBlob() works. Requires the server to send CORS headers
 * (Access-Control-Allow-Origin). Firebase Storage download URLs support this only
 * when CORS is explicitly configured via gsutil or Firebase console.
 */
async function loadAnonymousImage(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    const onAbort = () => { img.src = ''; reject(new DOMException('Aborted', 'AbortError')) }
    signal.addEventListener('abort', onAbort, { once: true })

    img.onload = () => { signal.removeEventListener('abort', onAbort); resolve(img) }
    img.onerror = () => {
      signal.removeEventListener('abort', onAbort)
      reject(new Error(`crossOrigin load failed for: ${url}`))
    }

    img.src = url
  })
}

async function loadSameOriginImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// ─── Canvas helpers ────────────────────────────────────────────────────────────

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) {
  const scale = Math.max(size / img.width, size / img.height)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  ctx.drawImage(img, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h)
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, size: number) {
  const grad = ctx.createRadialGradient(
    size * 0.5, size * 0.42, 0,
    size * 0.5, size * 0.5, size * 0.72,
  )
  grad.addColorStop(0, '#f5e8d8')
  grad.addColorStop(1, '#dcc8ae')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  ctx.font = '220px serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(160, 115, 70, 0.18)'
  ctx.fillText('🐾', size / 2, size / 2 + 80)
  ctx.textAlign = 'left'
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize = 48,
): number {
  let size = startSize
  ctx.font = `bold ${size}px system-ui, Arial, sans-serif`
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 4
    ctx.font = `bold ${size}px system-ui, Arial, sans-serif`
  }
  return size
}

function buildCardInfoLine(animal: Animal): string {
  const parts: string[] = []
  if (animal.species) parts.push(SPECIES_LABELS[animal.species])
  if (animal.sex) parts.push(SEX_LABELS[animal.sex])
  if (animal.estimatedAge?.trim()) parts.push(animal.estimatedAge.trim())
  if (animal.species === 'dog' && animal.size) {
    parts.push(`Porte ${SIZE_LABELS[animal.size].toLowerCase()}`)
  }
  return parts.join(' · ')
}

// ─── Main canvas draw ──────────────────────────────────────────────────────────

async function drawAnimalCard(
  canvas: HTMLCanvasElement,
  animal: Animal,
  photoUrl: string | null,
  signal: AbortSignal,
): Promise<DrawResult> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { photoStatus: 'none' }

  const S = CANVAS_SIZE
  canvas.width = S
  canvas.height = S

  // 1. Solid background
  ctx.fillStyle = '#f3eadc'
  ctx.fillRect(0, 0, S, S)

  // 2. Photo layer — crossOrigin=anonymous keeps the canvas untainted for toBlob().
  //    Falls back to placeholder if the server does not send CORS headers.
  let photoStatus: PhotoStatus = 'none'

  if (photoUrl) {
    try {
      const img = await loadAnonymousImage(photoUrl, signal)
      if (signal.aborted) return { photoStatus: 'none' }
      drawCover(ctx, img, S)
      photoStatus = 'clean'
    } catch (err) {
      if (signal.aborted) return { photoStatus: 'none' }
      console.warn(
        '[Arte de divulgação] Foto não carregou com crossOrigin=anonymous. ' +
        'Provavelmente o Firebase Storage não tem CORS configurado. ' +
        'URL:', photoUrl, '— Erro:', err,
      )
      photoStatus = 'cors_blocked'
      drawPlaceholder(ctx, S)
    }
  } else {
    drawPlaceholder(ctx, S)
  }

  if (signal.aborted) return { photoStatus: 'none' }

  // 3. Bottom gradient
  const bg = ctx.createLinearGradient(0, S * 0.38, 0, S)
  bg.addColorStop(0, `rgba(${DARK_RGB}, 0)`)
  bg.addColorStop(0.48, `rgba(${DARK_RGB}, 0.72)`)
  bg.addColorStop(1, `rgba(${DARK_RGB}, 0.96)`)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, S, S)

  // 4. Top gradient for logo contrast
  const tg = ctx.createLinearGradient(0, 0, 0, 180)
  tg.addColorStop(0, `rgba(${DARK_RGB}, 0.60)`)
  tg.addColorStop(1, `rgba(${DARK_RGB}, 0)`)
  ctx.fillStyle = tg
  ctx.fillRect(0, 0, S, 180)

  // 5. Upeva logo — same-origin, no CORS required
  try {
    const logo = await loadSameOriginImage('/upeva.jpg')
    const logoSize = 110
    const logoX = S - logoSize - 40
    const logoY = 36
    ctx.save()
    drawRoundRect(ctx, logoX, logoY, logoSize, logoSize, 18)
    ctx.clip()
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
    ctx.restore()
  } catch {
    ctx.font = 'bold 44px system-ui, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.textAlign = 'right'
    ctx.fillText('upeva', S - 48, 96)
    ctx.textAlign = 'left'
  }

  // 6. Bottom text
  const PAD = 64
  const baseY = S - 72

  ctx.font = '36px system-ui, Arial, sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)'
  ctx.fillText(buildCardInfoLine(animal), PAD, baseY - 248)

  const nameSize = fitFontSize(ctx, animal.name, S - PAD * 2, 112)
  ctx.font = `bold ${nameSize}px system-ui, Arial, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.50)'
  ctx.shadowBlur = 20
  ctx.fillText(animal.name, PAD, baseY - 136)
  ctx.shadowBlur = 0

  const BADGE = 'Disponível para adoção'
  ctx.font = 'bold 32px system-ui, Arial, sans-serif'
  const bMet = ctx.measureText(BADGE)
  const bPX = 30
  const bPY = 14
  const bW = bMet.width + bPX * 2
  const bH = 58
  ctx.fillStyle = BADGE_COLOR
  drawRoundRect(ctx, PAD, baseY - 66, bW, bH, 14)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(BADGE, PAD + bPX, baseY - 66 + bPY + 30)

  return { photoStatus }
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface SocialPostModalProps {
  open: boolean
  onClose: () => void
  animal: Animal
}

export function SocialPostModal({ open, onClose, animal }: SocialPostModalProps) {
  const coverIdx = Math.min(animal.coverPhotoIndex, Math.max(0, animal.photos.length - 1))
  const adoptionUrl = getAnimalAdoptionUrl(animal.id)

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(coverIdx)
  const [caption, setCaption] = useState(() => buildAnimalSocialPost(animal, adoptionUrl))
  const [copied, setCopied] = useState(false)
  const [corsBlocked, setCorsBlocked] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Drawing updates an external DOM element (canvas), not React state — useEffect is correct here.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !open) return

    const photoUrl = animal.photos[selectedPhotoIndex] ?? null
    const abort = new AbortController()

    drawAnimalCard(canvas, animal, photoUrl, abort.signal)
      .then(({ photoStatus }) => {
        if (abort.signal.aborted) return
        setCorsBlocked(photoStatus === 'cors_blocked')
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return
        console.error('[Arte de divulgação] Canvas render error:', err)
      })

    return () => abort.abort()
  }, [open, animal, selectedPhotoIndex])

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return

    setDownloadError(null)

    const safeName = animal.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setDownloadError('Não foi possível gerar o arquivo. Tente fechar e abrir o modal novamente.')
            return
          }
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `upeva-${safeName}-adocao.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        },
        'image/png',
      )
    } catch (err) {
      console.error('[Arte de divulgação] toBlob failed:', err)
      setDownloadError('O download falhou. O canvas pode estar inacessível.')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar arte de divulgação"
      size="xl"
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="flex max-h-[72vh] flex-col gap-5 overflow-y-auto pr-1">

        {/* Photo selector */}
        {animal.photos.length > 1 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">Escolher foto</h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {animal.photos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setSelectedPhotoIndex(i)}
                  aria-label={`Foto ${i + 1}`}
                  aria-pressed={selectedPhotoIndex === i}
                  className={cn(
                    'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                    selectedPhotoIndex === i
                      ? 'border-primary ring-2 ring-primary ring-offset-1'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CORS warning */}
        {corsBlocked && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              A foto não pôde ser incluída na arte por restrições de CORS do Firebase Storage.
              A arte foi gerada com placeholder e pode ser baixada normalmente.
              Para incluir a foto, o CORS do Firebase Storage precisa ser configurado.
            </p>
          </div>
        )}

        {/* Canvas preview */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Arte</h3>
          <div className="overflow-hidden rounded-xl border border-border bg-muted">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ aspectRatio: '1 / 1', display: 'block' }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Prévia 1080×1080 px · ideal para o feed do Instagram
          </p>
        </div>

        {/* Download error */}
        {downloadError && (
          <p role="alert" className="text-sm text-danger">
            {downloadError}
          </p>
        )}

        {/* Download + copy actions */}
        <div className="flex gap-2">
          <Button type="button" className="flex-1 gap-1.5" onClick={handleDownload}>
            <Download size={15} />
            Baixar imagem
          </Button>
          <Button
            type="button"
            variant={copied ? 'secondary' : 'outline'}
            className="flex-1 gap-1.5"
            onClick={handleCopy}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copiado!' : 'Copiar legenda'}
          </Button>
        </div>

        {/* Caption — editable */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Legenda</h3>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={12}
          />
          <p className="text-xs text-muted-foreground">
            O link de adoção usa a URL atual do navegador como base. Verifique antes de publicar.
          </p>
        </div>

      </div>
    </Modal>
  )
}
