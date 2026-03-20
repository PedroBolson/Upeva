import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, X, AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

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
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(
    (incoming: File[]) => {
      setSizeError(null)
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
    if (disabled) return
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    )
    addFiles(files)
  }

  function removeFile(index: number) {
    const updated = value.filter((_, i) => i !== index)
    onChange?.(updated)
  }

  const previews = useMemo(() => value.map((f) => URL.createObjectURL(f)), [value])

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url))
  }, [previews])

  const activeError = error ?? sizeError

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {label && (
        <span className="text-sm font-medium text-foreground">{label}</span>
      )}

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Área de upload de imagens"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed',
          'cursor-pointer p-8 transition-colors duration-150 text-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          dragOver && !disabled
            ? 'border-primary bg-accent'
            : 'border-border hover:border-primary hover:bg-accent',
          disabled && 'cursor-not-allowed opacity-50',
          activeError && 'border-danger',
        )}
      >
        <ImagePlus className="text-muted-foreground" size={28} strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-primary">Clique para selecionar</span> ou arraste aqui
        </p>
        <p className="text-xs text-muted-foreground">
          PNG, JPG, WEBP até {Math.round(maxSizeBytes / 1024 / 1024)}MB
          {multiple && maxFiles && ` · máximo ${maxFiles} fotos`}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
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
            <div key={i} className="relative aspect-square rounded-md overflow-hidden group">
              <img
                src={src}
                alt={`Preview ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                aria-label={`Remover foto ${i + 1}`}
                className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  'bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity',
                )}
              >
                <X className="text-white" size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
