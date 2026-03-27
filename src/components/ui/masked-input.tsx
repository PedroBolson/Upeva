import { forwardRef } from 'react'
import { Input } from './input'

export type InputMask = 'cpf' | 'phone'

const MASK_PATTERNS: Record<InputMask, string> = {
  cpf: '999.999.999-99',    // XXX.XXX.XXX-XX  (11 digits)
  phone: '(99) 99999-9999', // (XX) XXXXX-XXXX (11 digits)
}

function applyMask(raw: string, mask: string): string {
  const maxDigits = (mask.match(/9/g) ?? []).length
  const digits = raw.replace(/\D/g, '').slice(0, maxDigits)
  let result = ''
  let di = 0
  for (const c of mask) {
    if (di >= digits.length) break
    if (c === '9') result += digits[di++]
    else result += c
  }
  return result
}

interface MaskedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  mask: InputMask
  label?: string
  error?: string
  hint?: string
  /** Called with the masked string (e.g. "(11) 99999-9999") — works directly with
   *  react-hook-form Controller's field.onChange, which accepts string values. */
  onChange?: (value: string) => void
}

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, ...props }, ref) => {
    const pattern = MASK_PATTERNS[mask]
    const maskedValue = typeof value === 'string' ? applyMask(value, pattern) : ''

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={maskedValue}
        onChange={(e) => onChange?.(applyMask(e.target.value, pattern))}
        {...props}
      />
    )
  },
)

MaskedInput.displayName = 'MaskedInput'
