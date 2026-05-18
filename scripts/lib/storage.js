/**
 * scripts/lib/storage.js
 * Firebase Storage scan and delete logic shared by reset-storage.js and prod-reset.js.
 *
 * Scans the entire bucket by listing all files (not relationship-based).
 * This intentionally catches orphaned files that are no longer referenced by Firestore.
 *
 * Protected prefixes: add strings to PROTECTED_PREFIXES to exclude paths from deletion.
 * Empty array = delete all files in the bucket (default for a full production reset).
 */

import { green, red, cyan, dim, formatBytes } from './colors.js'

// File path prefixes that must never be deleted.
// Example: ['backups/', 'admin-assets/'] to protect those paths.
// Leave empty to delete everything in the bucket.
export const PROTECTED_PREFIXES = []

// How many files to delete concurrently per batch.
const DELETE_BATCH_SIZE = 50

// ── Scan ─────────────────────────────────────────────────────────────────────
// Lists all files in the bucket and separates them into filesToDelete and protectedFiles.
// Uses autoPagination (default) so all files are returned regardless of bucket size.
//
// Returns:
//   filesToDelete  — File objects that will be deleted
//   protectedFiles — File objects skipped because their path matches a protected prefix
//   totalBytes     — total bytes of files to delete
//   byPrefix       — map of top-level prefix → { count, bytes }

export async function scanStorage(bucket) {
  const [allFiles] = await bucket.getFiles()

  let totalBytes = 0
  const byPrefix = {}
  const filesToDelete = []
  const protectedFiles = []

  for (const file of allFiles) {
    const isProtected = PROTECTED_PREFIXES.length > 0 &&
      PROTECTED_PREFIXES.some((p) => file.name.startsWith(p))

    if (isProtected) {
      protectedFiles.push(file)
      continue
    }

    const size = parseInt(file.metadata?.size ?? '0', 10)
    filesToDelete.push(file)
    totalBytes += size

    // Group by top-level path segment for display
    const slashIdx = file.name.indexOf('/')
    const prefix = slashIdx === -1 ? '(root)' : file.name.slice(0, slashIdx + 1)
    if (!byPrefix[prefix]) byPrefix[prefix] = { count: 0, bytes: 0 }
    byPrefix[prefix].count++
    byPrefix[prefix].bytes += size
  }

  return {
    filesToDelete,
    protectedFiles,
    totalBytes,
    byPrefix,
    totalScanned: allFiles.length,
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
// Deletes files in concurrent batches with progress logging.
// Protected prefixes are checked again here as a redundant guard.
//
// Returns:
//   deletedCount  — number of files successfully deleted
//   failedCount   — number of files that failed
//   deletedBytes  — total bytes freed

export async function deleteStorageFiles(filesToDelete, log = console.log) {
  if (filesToDelete.length === 0) return { deletedCount: 0, failedCount: 0, deletedBytes: 0 }

  let deletedCount = 0
  let failedCount = 0
  let deletedBytes = 0

  for (let i = 0; i < filesToDelete.length; i += DELETE_BATCH_SIZE) {
    const batch = filesToDelete.slice(i, i + DELETE_BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map((f) => f.delete())
    )

    for (let j = 0; j < batch.length; j++) {
      const file = batch[j]
      const result = results[j]
      const size = parseInt(file.metadata?.size ?? '0', 10)

      if (result.status === 'fulfilled') {
        log(dim(`  ✓ ${file.name}  ${formatBytes(size)}`))
        deletedCount++
        deletedBytes += size
      } else {
        log(red(`  ✗ ${file.name}: ${result.reason?.message ?? 'unknown error'}`))
        failedCount++
      }
    }
  }

  return { deletedCount, failedCount, deletedBytes }
}
