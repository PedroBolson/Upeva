import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, X, AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { ConfirmModal } from './confirm-modal'

interface FileUploadProps {
  label?: string
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxSizeBytes?: number
  value?: File[]
  onChange?: (files: File[]) => void
  error?: string
  className?: string
  disabled?: boolean
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB

export function FileUpload({
  label,
  accept = 'image/*',
  multiple = false,
  maxFiles = 10,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  value = [],
  onChange,
  error,
  className,
  disabled = false,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)
  const [removeIndex, setRemoveIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const capacityReached = multiple && value.length >= maxFiles
  const isDisabled = disabled || capacityReached

  const addFiles = useCallback(
    (incoming: File[]) => {
      setSizeError(null)
      if (incoming.length === 0) {
        setSizeError('Adicione apenas imagens PNG, JPG ou WEBP.')
        return
      }
      if (multiple && value.length + incoming.length > maxFiles) {
        setSizeError(`Você pode adicionar no máximo ${maxFiles} foto${maxFiles !== 1 ? 's' : ''}.`)
        return
      }
      const oversized = incoming.find((f) => f.size > maxSizeBytes)
      if (oversized) {
        setSizeError(`"${oversized.name}" excede o tamanho máximo de ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`)
        return
      }
      const combined = multiple
        ? [...value, ...incoming].slice(0, maxFiles)
        : incoming.slice(0, 1)
      onChange?.(combined)
    },
    [value, multiple, maxFiles, maxSizeBytes, onChange],
  )

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    addFiles(files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (isDisabled) return
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    )
    addFiles(files)
  }

  function removeFile(index: number) {
    const updated = value.filter((_, i) => i !== index)
    onChange?.(updated)
  }

  function confirmRemoveFile() {
    if (removeIndex === null) return
    removeFile(removeIndex)
    setRemoveIndex(null)
  }

  const previews = useMemo(() => value.map((f) => URL.createObjectURL(f)), [value])

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url))
  }, [previews])

  const activeError = error ?? sizeError

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ConfirmModal
        open={removeIndex !== null}
        onClose={() => setRemoveIndex(null)}
        onConfirm={confirmRemoveFile}
        title="Remover foto?"
        description="Essa imagem será removida da seleção atual."
        confirmLabel="Remover foto"
        cancelLabel="Cancelar"
        variant="danger"
      />

      {label && (
        <span className="text-sm font-medium text-foreground">{label}</span>
      )}

      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="Área de upload de imagens"
        onDragOver={(e) => {
          e.preventDefault()
          if (!isDisabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isDisabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed',
          'cursor-pointer p-8 transition-colors duration-150 text-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          dragOver && !isDisabled
            ? 'border-primary bg-accent'
            : 'border-border hover:border-primary hover:bg-accent',
          isDisabled && 'cursor-not-allowed opacity-50',
          activeError && 'border-danger',
        )}
      >
        <ImagePlus className="text-muted-foreground" size={28} strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">
          {dragOver && !isDisabled ? (
            <span className="font-medium text-primary">Solte as imagens aqui</span>
          ) : capacityReached ? (
            <span className="font-medium text-foreground">Limite de fotos atingido</span>
          ) : (
            <>
              <span className="font-medium text-primary">Clique para selecionar</span> ou arraste aqui
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {capacityReached ? (
            `Remova uma foto para adicionar outra.`
          ) : (
            <>
              PNG, JPG, WEBP até {Math.round(maxSizeBytes / 1024 / 1024)}MB
              {multiple && maxFiles && ` · máximo ${maxFiles} fotos`}
            </>
          )}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={isDisabled}
        onChange={handleInput}
        className="sr-only"
        aria-hidden="true"
      />

      {activeError && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle size={12} />
          {activeError}
        </p>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-border bg-card">
              <img
                src={src}
                alt={`Preview ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-end bg-linear-to-t from-foreground/80 via-foreground/45 to-transparent p-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRemoveIndex(i)
                  }}
                  aria-label={`Remover foto ${i + 1}`}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-full',
                    'bg-background/90 text-danger transition-colors hover:bg-danger hover:text-danger-foreground',
                  )}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
