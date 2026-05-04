export const PASSWORD_POLICY = {
  minLength: 8,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
} as const

export const PASSWORD_POLICY_MESSAGES = {
  minLength: 'Senha deve ter ao menos 8 caracteres.',
  uppercase: 'Senha deve conter ao menos uma letra maiúscula.',
  lowercase: 'Senha deve conter ao menos uma letra minúscula.',
  number: 'Senha deve conter ao menos um número.',
} as const

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_POLICY.minLength) {
    return PASSWORD_POLICY_MESSAGES.minLength
  }
  if (!PASSWORD_POLICY.uppercase.test(password)) {
    return PASSWORD_POLICY_MESSAGES.uppercase
  }
  if (!PASSWORD_POLICY.lowercase.test(password)) {
    return PASSWORD_POLICY_MESSAGES.lowercase
  }
  if (!PASSWORD_POLICY.number.test(password)) {
    return PASSWORD_POLICY_MESSAGES.number
  }

  return null
}
