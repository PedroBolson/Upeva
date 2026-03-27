import { useEffect, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Input } from './input'

export interface ViaCepAddress {
  street: string
  neighborhood: string
  city: string
  state: string
}

export interface CepInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  onAddressFound: (address: ViaCepAddress) => void
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function CepInput({
  value,
  onChange,
  onBlur,
  onAddressFound,
  label = 'CEP',
  error,
  hint,
  required,
}: CepInputProps) {
  const [loading, setLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const lastQueried = useRef('')

  useEffect(() => {
    if (value.replace(/\D/g, '').length === 8) lookup(value)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function lookup(masked: string) {
    const digits = masked.replace(/\D/g, '')
    if (digits.length !== 8 || digits === lastQueried.current) return
    lastQueried.current = digits
    setLoading(true)
    setLookupError(null)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) throw new Error('not ok')
      const data = (await res.json()) as {
        erro?: boolean
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
      }
      if (data.erro) {
        setLookupError('CEP não encontrado.')
        return
      }
      onAddressFound({
        street: data.logradouro ?? '',
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? '',
        state: data.uf ?? '',
      })
    } catch {
      setLookupError('Não foi possível buscar o CEP. Preencha o endereço manualmente.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value)
    onChange(masked)
    if (masked.replace(/\D/g, '').length === 8) lookup(masked)
  }

  const displayError = error ?? lookupError ?? undefined

  return (
    <Input
      label={label}
      placeholder="00000-000"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onBlur={() => { lookup(value); onBlur?.() }}
      error={displayError}
      hint={hint}
      required={required}
      rightIcon={
        loading
          ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
          : <Search size={14} className="text-muted-foreground" />
      }
    />
  )
}
