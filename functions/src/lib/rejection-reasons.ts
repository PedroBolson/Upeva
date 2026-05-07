export type RejectionReason =
  | "inadequate_housing"
  | "no_landlord_permission"
  | "financial_instability"
  | "previous_animal_negligence"
  | "incompatible_lifestyle"
  | "other";

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  inadequate_housing: "Moradia inadequada",
  no_landlord_permission: "Sem autorização do proprietário",
  financial_instability: "Instabilidade financeira",
  previous_animal_negligence: "Histórico de negligência com animais",
  incompatible_lifestyle: "Estilo de vida incompatível",
  other: "Outro",
};

export const VALID_REJECTION_REASONS = new Set<RejectionReason>([
  "inadequate_housing",
  "no_landlord_permission",
  "financial_instability",
  "previous_animal_negligence",
  "incompatible_lifestyle",
  "other",
]);

export function getRejectionReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Motivo não informado";
  return REJECTION_REASON_LABELS[reason as RejectionReason] ?? reason;
}
