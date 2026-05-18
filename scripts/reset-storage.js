/**
 * reset-storage.js
 *
 * Deletes all files in the Firebase Storage default bucket.
 * Does not touch Firestore. Does not touch Firebase Auth.
 *
 * Scans the entire bucket directly (not relationship-based), so orphaned files
 * that are no longer referenced by Firestore are also found and deleted.
 *
 * Protected prefixes: edit PROTECTED_PREFIXES in scripts/lib/storage.js to
 * exclude specific paths from deletion.
 *
 * USAGE
 *   Dry-run (default — safe, nothing deleted):
 *     node scripts/reset-storage.js
 *     npm run storage:reset:dry
 *
 *   Real deletion (IRREVERSIBLE):
 *     node scripts/reset-storage.js --confirm-delete
 *     npm run storage:reset
 *
 * CREDENTIALS
 *   Same as reset-db.js. See that file for details.
 */

import { deleteApp } from 'firebase-admin/app'
import { red, yellow, green, bold, dim, cyan, HR, HR_THIN, formatBytes } from './lib/colors.js'
import { initAdmin } from './lib/admin.js'
import { PROTECTED_PREFIXES, scanStorage, deleteStorageFiles } from './lib/storage.js'

const CONFIRM_DELETE = process.argv.includes('--confirm-delete')
const DRY_RUN = !CONFIRM_DELETE

async function main() {
  console.log('')
  console.log(bold(HR))
  console.log(bold('  UPEVA — Firebase Storage Reset'))
  console.log(bold(HR))
  console.log('')

  if (DRY_RUN) {
    console.log(yellow('  MODE: DRY-RUN — nothing will be deleted'))
    console.log(dim('  Pass --confirm-delete to perform real deletion'))
  } else {
    console.log(red(bold('  MODE: REAL DELETION — this is IRREVERSIBLE')))
  }
  console.log('')

  const { app, bucket, bucketName, projectId, creds } = initAdmin()
  console.log(dim(`  Project:     ${projectId}`))
  console.log(dim(`  Bucket:      ${bucketName}`))
  console.log(dim(`  Credentials: ${creds.source}`))

  if (PROTECTED_PREFIXES.length > 0) {
    console.log(dim(`  Protected:   ${PROTECTED_PREFIXES.join(', ')}`))
  }
  console.log('')

  // Scan
  console.log('  Scanning Storage...')
  let scan
  try {
    scan = await scanStorage(bucket)
  } catch (err) {
    console.error(red(`\n✗ Failed to scan Storage bucket: ${err.message}\n`))
    await deleteApp(app)
    process.exit(1)
  }

  const { filesToDelete, protectedFiles, totalBytes, byPrefix } = scan

  if (filesToDelete.length === 0 && protectedFiles.length === 0) {
    console.log(green('\n  Storage bucket is already empty. Nothing to do.\n'))
    await deleteApp(app)
    return
  }

  // Files by prefix
  console.log('')
  console.log(bold('  FILES BY PREFIX'))
  console.log('')

  const prefixes = Object.keys(byPrefix).sort()
  if (prefixes.length === 0) {
    console.log(dim('  (no files to delete)'))
  } else {
    const maxPrefixLen = Math.max(...prefixes.map((p) => p.length), 8)
    for (const prefix of prefixes) {
      const { count, bytes } = byPrefix[prefix]
      console.log(
        red(`  DEL  `) +
        prefix.padEnd(maxPrefixLen + 2) +
        `${String(count).padStart(4)} file${count !== 1 ? 's' : ' '}  ` +
        dim(formatBytes(bytes))
      )
    }
  }

  if (protectedFiles.length > 0) {
    console.log(green(`  SKIP  (protected prefixes)  ${protectedFiles.length} file(s)`))
  }

  console.log('')
  console.log(HR_THIN)
  console.log(
    `  Total:  ${filesToDelete.length} file${filesToDelete.length !== 1 ? 's' : ''}` +
    `   ${formatBytes(totalBytes)}`
  )
  if (protectedFiles.length > 0) {
    console.log(green(`  Skip:   ${protectedFiles.length} file(s) (protected)`))
  }
  console.log(HR_THIN)

  if (filesToDelete.length === 0) {
    console.log(green('\n  All files are protected. Nothing to delete.\n'))
    await deleteApp(app)
    return
  }

  // Stop here in dry-run
  if (DRY_RUN) {
    console.log('')
    console.log(bold(HR))
    console.log(yellow('  DRY-RUN complete. No files were deleted.'))
    console.log(yellow('  To perform the real deletion:'))
    console.log(cyan('    node scripts/reset-storage.js --confirm-delete'))
    console.log(bold(HR))
    console.log('')
    await deleteApp(app)
    return
  }

  // Real deletion
  console.log('')
  console.log(red(bold(HR)))
  console.log(red(bold('  DELETING — this cannot be undone')))
  console.log(red(bold(HR)))
  console.log('')

  const { deletedCount, failedCount, deletedBytes } =
    await deleteStorageFiles(filesToDelete)

  console.log('')
  console.log(bold(HR))
  if (failedCount === 0) {
    console.log(green(bold(`  ✓ Done. ${deletedCount} file(s) deleted (${formatBytes(deletedBytes)} freed).`)))
    console.log(green('  ✓ Firestore untouched.'))
    console.log(green('  ✓ Firebase Auth untouched.'))
  } else {
    console.log(yellow(`  ⚠ ${deletedCount} deleted, ${failedCount} failed.`))
    console.log(red('    Re-run to retry failed files.'))
  }
  console.log(bold(HR))
  console.log('')

  await deleteApp(app)
  if (failedCount > 0) process.exit(1)
}

main().catch((err) => {
  console.error(red(`\n✗ Unexpected error: ${err.message}\n`))
  process.exit(1)
})
