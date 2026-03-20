import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui'

interface AnimalFilterSearchFieldProps {
  value: string
  onChange: (value: string | undefined) => void
}

export function AnimalFilterSearchField({
  value,
  onChange,
}: AnimalFilterSearchFieldProps) {
  return (
    <Input
      placeholder="Buscar por nome..."
      value={value}
      onChange={(e) => onChange(e.target.value || undefined)}
      leftIcon={<Search size={16} />}
      rightIcon={
        value ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label="Limpar busca"
            className="pointer-events-auto rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={14} />
          </button>
        ) : undefined
      }
      aria-label="Buscar animal por nome"
      className="h-11 rounded-xl"
    />
  )
}
