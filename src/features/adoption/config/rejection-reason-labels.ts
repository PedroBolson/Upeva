import type { RejectionReason } from '@/types/common'

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  inadequate_housing: 'Moradia inadequada',
  no_landlord_permission: 'Sem autorização do proprietário',
  financial_instability: 'Instabilidade financeira',
  previous_animal_negligence: 'Histórico de negligência com animais',
  incompatible_lifestyle: 'Estilo de vida incompatível',
  other: 'Outro',
}

export const REJECTION_REASON_OPTIONS: Array<{ value: RejectionReason; label: string }> = [
  { value: 'inadequate_housing', label: REJECTION_REASON_LABELS.inadequate_housing },
  { value: 'no_landlord_permission', label: REJECTION_REASON_LABELS.no_landlord_permission },
  { value: 'financial_instability', label: REJECTION_REASON_LABELS.financial_instability },
  { value: 'previous_animal_negligence', label: REJECTION_REASON_LABELS.previous_animal_negligence },
  { value: 'incompatible_lifestyle', label: REJECTION_REASON_LABELS.incompatible_lifestyle },
  { value: 'other', label: REJECTION_REASON_LABELS.other },
]

export function getRejectionReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'Motivo não informado'
  return REJECTION_REASON_LABELS[reason as RejectionReason] ?? reason
}
