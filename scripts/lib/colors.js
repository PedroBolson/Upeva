export const red    = (s) => `\x1b[31m${s}\x1b[0m`
export const yellow = (s) => `\x1b[33m${s}\x1b[0m`
export const green  = (s) => `\x1b[32m${s}\x1b[0m`
export const cyan   = (s) => `\x1b[36m${s}\x1b[0m`
export const bold   = (s) => `\x1b[1m${s}\x1b[0m`
export const dim    = (s) => `\x1b[2m${s}\x1b[0m`
export const HR     = '━'.repeat(52)
export const HR_THIN = '─'.repeat(52)

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
