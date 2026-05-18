/**
 * prod-reset.js
 *
 * Full production database reset orchestrator.
 * Runs Firestore reset and Storage reset together in a single operation.
 *
 * In dry-run mode:
 *   - Scans Firestore and Storage
 *   - Prints a combined summary of everything that would be deleted
 *   - Does NOT delete anything
 *
 * In --confirm-delete mode:
 *   - Prints the same combined summary
 *   - Deletes all target Firestore collections (except users)
 *   - Deletes all files in the Storage bucket
 *
 * WHAT IS NEVER TOUCHED
 *   - Firebase Authentication users
 *   - Firestore `users` collection
 *   - Any `users/{uid}` document
 *
 * USAGE
 *   Dry-run (default — safe, nothing deleted):
 *     node scripts/prod-reset.js
 *     npm run prod:reset:dry
 *
 *   Real deletion (IRREVERSIBLE):
 *     node scripts/prod-reset.js --confirm-delete
 *     npm run prod:reset
 *
 * RECOMMENDED SEQUENCE
 *   1. npm run prod:reset:dry      ← review output carefully
 *   2. npm run prod:reset          ← execute when ready
 *   3. npm run db:validate:dry     ← verify user documents are intact
 *   4. npm run db:validate         ← patch any missing search fields
 *
 * CREDENTIALS
 *   Same as reset-db.js. See that file for details.
 */

import { deleteApp } from 'firebase-admin/app'
import { red, yellow, green, bold, dim, cyan, HR, HR_THIN, formatBytes } from './lib/colors.js'
import { initAdmin } from './lib/admin.js'
import { PROTECTED_COLLECTIONS, scanFirestore, deleteFirestoreCollections } from './lib/firestore.js'
import { PROTECTED_PREFIXES, scanStorage, deleteStorageFiles } from './lib/storage.js'

const CONFIRM_DELETE = process.argv.includes('--confirm-delete')
const DRY_RUN = !CONFIRM_DELETE

// ── Header ────────────────────────────────────────────────────────────────────

function printHeader() {
  console.log('')
  console.log(bold(HR))
  console.log(bold('  UPEVA — Full Production Reset'))
  console.log(bold(HR))
  console.log('')

  if (DRY_RUN) {
    console.log(yellow('  MODE: DRY-RUN — no data will be deleted'))
    console.log(dim('  Pass --confirm-delete to perform real deletion'))
  } else {
    console.log(red(bold('  MODE: REAL DELETION — IRREVERSIBLE')))
    console.log(red('  Deletes all Firestore collections (except users) and all Storage files.'))
  }
  console.log('')
}

// ── Section: Firestore ────────────────────────────────────────────────────────

function printFirestoreSection(scan) {
  const { allIds, toDelete, toSkip, counts } = scan

  console.log(bold('  ── FIRESTORE ─────────────────────────────────────'))
  console.log('')

  if (allIds.length === 0) {
    console.log(green('  (empty — nothing to delete)'))
    console.log('')
    return
  }

  for (const id of allIds) {
    const count     = counts[id]
    const countStr  = count === null ? dim('(count unavailable)') : `${count} docs`
    const isSkipped = PROTECTED_COLLECTIONS.has(id)
    const badge     = isSkipped ? green(' SKIP') : red('  DEL')
    console.log(`  [${badge}]  ${id.padEnd(32)} ${dim(countStr)}`)
  }

  console.log('')
  console.log(green(`  Protected (untouched):  ${toSkip.join(', ')}`))

  if (toDelete.length > 0) {
    const knownDocs    = toDelete.reduce((s, id) => (counts[id] !== null ? s + counts[id] : s), 0)
    const unknownColls = toDelete.filter((id) => counts[id] === null).length
    const docEst = unknownColls === 0 ? `~${knownDocs} docs` : `~${knownDocs} docs + ${unknownColls} uncounted`
    console.log(red(`  To delete:              ${toDelete.length} collection(s)  (${docEst})`))
    console.log(dim('  Subcollections are deleted recursively.'))
  } else {
    console.log(green('  To delete:              0 — Firestore is already clean'))
  }
  console.log('')
}

// ── Section: Storage ─────────────────────────────────────────────────────────

function printStorageSection(storageScan, bucketName) {
  const { filesToDelete, protectedFiles, totalBytes, byPrefix } = storageScan

  console.log(bold(`  ── STORAGE (${bucketName}) ─`))
  console.log('')

  if (filesToDelete.length === 0 && protectedFiles.length === 0) {
    console.log(green('  (empty — nothing to delete)'))
    console.log('')
    return
  }

  const prefixes = Object.keys(byPrefix).sort()
  if (prefixes.length === 0) {
    console.log(dim('  (no files to delete)'))
  } else {
    const maxPrefixLen = Math.max(...prefixes.map((p) => p.length), 8)
    for (const prefix of prefixes) {
      const { count, bytes } = byPrefix[prefix]
      console.log(
        red('  DEL  ') +
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
  if (filesToDelete.length > 0) {
    console.log(
      red(`  To delete:  ${filesToDelete.length} file${filesToDelete.length !== 1 ? 's' : ''}`) +
      `   ${formatBytes(totalBytes)}`
    )
  } else {
    console.log(green('  To delete:  0 — Storage is already clean'))
  }
  if (protectedFiles.length > 0) {
    console.log(green(`  Protected:  ${protectedFiles.length} file(s) — untouched`))
  }
  console.log(HR_THIN)
  console.log('')
}

// ── Combined summary ──────────────────────────────────────────────────────────

function printCombinedSummary(firestoreScan, storageScan) {
  const { toDelete: fsDelete, toSkip: fsSkip } = firestoreScan
  const { filesToDelete, totalBytes } = storageScan

  console.log(bold('  ── COMBINED SUMMARY ──────────────────────────────'))
  console.log('')
  console.log(`  Firestore:   ${red(`${fsDelete.length} collection(s) to delete`)}`)
  console.log(`               ${green(`${fsSkip.join(', ')} → untouched`)}`)
  console.log(`  Storage:     ${red(`${filesToDelete.length} file(s) to delete`)}   ${dim(formatBytes(totalBytes))}`)
  console.log(`  Auth:        ${green('Firebase Auth users → untouched')}`)
  console.log('')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  printHeader()

  const { app, db, bucket, bucketName, projectId, creds } = initAdmin()
  console.log(dim(`  Project:     ${projectId}`))
  console.log(dim(`  Bucket:      ${bucketName}`))
  console.log(dim(`  Credentials: ${creds.source}`))

  if (PROTECTED_PREFIXES.length > 0) {
    console.log(dim(`  Storage protected prefixes: ${PROTECTED_PREFIXES.join(', ')}`))
  }
  console.log('')

  // ── Scan phase (always runs, in both dry-run and real mode) ──────────────

  process.stdout.write('  Scanning Firestore... ')
  let firestoreScan
  try {
    firestoreScan = await scanFirestore(db)
    console.log(green(`done  (${firestoreScan.allIds.length} collections)`))
  } catch (err) {
    console.log('')
    console.error(red(`\n✗ Firestore scan failed: ${err.message}\n`))
    await deleteApp(app)
    process.exit(1)
  }

  process.stdout.write('  Scanning Storage...   ')
  let storageScan
  try {
    storageScan = await scanStorage(bucket)
    console.log(green(`done  (${storageScan.totalScanned} files)`))
  } catch (err) {
    console.log('')
    console.error(red(`\n✗ Storage scan failed: ${err.message}\n`))
    await deleteApp(app)
    process.exit(1)
  }

  // ── Print full breakdown ──────────────────────────────────────────────────

  console.log('')
  console.log(bold(HR))
  console.log('')

  printFirestoreSection(firestoreScan)
  printStorageSection(storageScan, bucketName)
  printCombinedSummary(firestoreScan, storageScan)

  const nothingToDelete =
    firestoreScan.toDelete.length === 0 && storageScan.filesToDelete.length === 0

  if (nothingToDelete) {
    console.log(bold(HR))
    console.log(green('  Everything is already clean. Nothing to delete.'))
    console.log(bold(HR))
    console.log('')
    await deleteApp(app)
    return
  }

  // ── Dry-run: stop here ────────────────────────────────────────────────────

  if (DRY_RUN) {
    console.log(bold(HR))
    console.log(yellow('  DRY-RUN complete. No data was deleted.'))
    console.log(yellow('  Review the output above, then run:'))
    console.log(cyan('    node scripts/prod-reset.js --confirm-delete'))
    console.log(bold(HR))
    console.log('')
    await deleteApp(app)
    return
  }

  // ── Real deletion ─────────────────────────────────────────────────────────

  console.log(red(bold(HR)))
  console.log(red(bold('  STARTING DELETION — this cannot be undone')))
  console.log(red(bold(HR)))
  console.log('')

  // Step 1: Firestore
  let fsResult = { deletedCount: 0, failedCollections: [] }
  if (firestoreScan.toDelete.length > 0) {
    console.log(bold('  ── STEP 1/2: Firestore ───────────────────────────'))
    console.log('')
    fsResult = await deleteFirestoreCollections(db, firestoreScan.toDelete)
    console.log('')
  } else {
    console.log(dim('  ── STEP 1/2: Firestore — nothing to delete'))
    console.log('')
  }

  // Step 2: Storage
  let storageResult = { deletedCount: 0, failedCount: 0, deletedBytes: 0 }
  if (storageScan.filesToDelete.length > 0) {
    console.log(bold('  ── STEP 2/2: Storage ─────────────────────────────'))
    console.log('')
    storageResult = await deleteStorageFiles(storageScan.filesToDelete)
    console.log('')
  } else {
    console.log(dim('  ── STEP 2/2: Storage — nothing to delete'))
    console.log('')
  }

  // Final report
  const fsOk      = fsResult.failedCollections.length === 0
  const storageOk = storageResult.failedCount === 0
  const allOk     = fsOk && storageOk

  console.log(allOk ? green(bold(HR)) : yellow(bold(HR)))
  if (allOk) {
    console.log(green(bold('  ✓ PRODUCTION RESET COMPLETE')))
  } else {
    console.log(yellow(bold('  ⚠ RESET COMPLETED WITH ERRORS — re-run to retry failures')))
  }
  console.log(allOk ? green(bold(HR)) : yellow(bold(HR)))
  console.log('')

  if (firestoreScan.toDelete.length > 0) {
    if (fsOk) {
      console.log(green(`  ✓ Firestore: ${fsResult.deletedCount} collection(s) deleted`))
    } else {
      console.log(yellow(`  ⚠ Firestore: ${fsResult.deletedCount} deleted, ${fsResult.failedCollections.length} failed (${fsResult.failedCollections.join(', ')})`))
    }
  }

  if (storageScan.filesToDelete.length > 0) {
    if (storageOk) {
      console.log(green(`  ✓ Storage:   ${storageResult.deletedCount} file(s) deleted  (${formatBytes(storageResult.deletedBytes)} freed)`))
    } else {
      console.log(yellow(`  ⚠ Storage:   ${storageResult.deletedCount} deleted, ${storageResult.failedCount} failed`))
    }
  }

  console.log(green('  ✓ users collection  — untouched'))
  console.log(green('  ✓ Firebase Auth     — untouched'))
  console.log('')

  if (!allOk) {
    console.log(yellow('  Re-run the command to retry any failed operations.'))
    console.log('')
  }

  await deleteApp(app)
  if (!allOk) process.exit(1)
}

main().catch((err) => {
  console.error(red(`\n✗ Unexpected error: ${err.message}\n`))
  process.exit(1)
})
