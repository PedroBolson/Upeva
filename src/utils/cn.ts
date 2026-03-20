type ClassValue = string | number | bigint | boolean | null | undefined | ClassValue[]

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat(Infinity as 1)
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' ')
}
