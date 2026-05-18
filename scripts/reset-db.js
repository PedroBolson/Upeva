/**
 * reset-db.js
 *
 * Deletes all Firestore root collections EXCEPT `users`.
 * Firebase Authentication is never touched.
 * The `users` collection and all `users/{uid}` documents are never touched.
 *
 * USAGE
 *   Dry-run (default — safe, no data deleted):
 *     node scripts/reset-db.js
 *     npm run db:reset:dry
 *
 *   Real deletion (IRREVERSIBLE):
 *     node scripts/reset-db.js --confirm-delete
 *     npm run db:reset
 *
 * CREDENTIALS
 *   Provide a service account key with Firestore admin access:
 *     1. GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *     2. Place serviceAccountKey.json in the project root (gitignored)
 *   Download: Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

import { deleteApp } from 'firebase-admin/app'
import { red, yellow, green, cyan, bold, dim, HR } from './lib/colors.js'
import { initAdmin } from './lib/admin.js'
import { PROTECTED_COLLECTIONS, scanFirestore, deleteFirestoreCollections } from './lib/firestore.js'

const CONFIRM_DELETE = process.argv.includes('--confirm-delete')
const DRY_RUN = !CONFIRM_DELETE

async function main() {
  console.log('')
  console.log(bold(HR))
  console.log(bold('  UPEVA — Firestore Database Reset'))
  console.log(bold(HR))
  console.log('')

  if (DRY_RUN) {
    console.log(yellow('  MODE: DRY-RUN — nothing will be deleted'))
    console.log(dim('  Pass --confirm-delete to perform real deletion'))
  } else {
    console.log(red(bold('  MODE: REAL DELETION — this is IRREVERSIBLE')))
  }
  console.log('')

  const { app, db, projectId, creds } = initAdmin()
  console.log(dim(`  Project:     ${projectId}`))
  console.log(dim(`  Credentials: ${creds.source}`))
  console.log('')

  // Scan
  console.log('  Scanning Firestore...')
  let scan
  try {
    scan = await scanFirestore(db)
  } catch (err) {
    console.error(red(`\n✗ Failed to scan Firestore: ${err.message}\n`))
    await deleteApp(app)
    process.exit(1)
  }

  const { allIds, toDelete, toSkip, counts } = scan

  if (allIds.length === 0) {
    console.log(green('\n  Firestore is already empty. Nothing to do.\n'))
    await deleteApp(app)
    return
  }

  // Collections table
  console.log('')
  console.log(bold('  COLLECTIONS'))
  console.log('')
  for (const id of allIds) {
    const count     = counts[id]
    const countStr  = count === null ? dim('(count unavailable)') : `${count} docs`
    const isSkipped = PROTECTED_COLLECTIONS.has(id)
    const badge     = isSkipped ? green(' SKIP') : red('  DEL')
    console.log(`  [${badge}]  ${id.padEnd(32)} ${dim(countStr)}`)
  }

  // Summary
  console.log('')
  console.log(bold('  SUMMARY'))
  console.log('')
  console.log(green(`  Skip (protected):   ${toSkip.length}  ${dim(`(${toSkip.join(', ')})`)}  ← untouched`))

  if (toDelete.length === 0) {
    console.log(green(`  Delete:             0 — nothing to delete`))
    console.log('')
    console.log(bold(HR))
    console.log(green('  Nothing to delete. Firestore is already clean.'))
    console.log(bold(HR))
    console.log('')
    await deleteApp(app)
    return
  }

  const knownDocs    = toDelete.reduce((s, id) => (counts[id] !== null ? s + counts[id] : s), 0)
  const unknownColls = toDelete.filter((id) => counts[id] === null).length
  const docEstimate  = unknownColls === 0 ? `~${knownDocs} docs` : `~${knownDocs} docs + ${unknownColls} uncounted collection(s)`

  console.log(red(`  Delete:             ${toDelete.length}  (${toDelete.join(', ')})`))
  console.log(`  Estimated docs:     ${docEstimate}`)
  console.log(dim('  Subcollections are also deleted recursively.'))

  // Stop here in dry-run
  if (DRY_RUN) {
    console.log('')
    console.log(bold(HR))
    console.log(yellow('  DRY-RUN complete. No data was deleted.'))
    console.log(yellow('  To perform the real deletion:'))
    console.log(cyan('    node scripts/reset-db.js --confirm-delete'))
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

  const { deletedCount, failedCollections } = await deleteFirestoreCollections(db, toDelete)

  console.log('')
  console.log(bold(HR))
  if (failedCollections.length === 0) {
    console.log(green(bold(`  ✓ Done. ${deletedCount} collection(s) deleted.`)))
    console.log(green('  ✓ users collection untouched.'))
    console.log(green('  ✓ Firebase Auth untouched.'))
  } else {
    console.log(yellow(`  ⚠ ${deletedCount} deleted, ${failedCollections.length} failed: ${failedCollections.join(', ')}`))
    console.log(red('    Re-run to retry failed collections.'))
  }
  console.log(bold(HR))
  console.log('')

  await deleteApp(app)
  if (failedCollections.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(red(`\n✗ Unexpected error: ${err.message}\n`))
  process.exit(1)
})
