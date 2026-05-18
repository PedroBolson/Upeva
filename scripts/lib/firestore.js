/**
 * scripts/lib/firestore.js
 * Firestore scan and delete logic shared by reset-db.js and prod-reset.js.
 */

import { green, yellow, red, cyan } from './colors.js'

// Collections that must never be deleted.
export const PROTECTED_COLLECTIONS = new Set(['users'])

// ── Scan ─────────────────────────────────────────────────────────────────────
// Returns a summary of all root collections without modifying anything.
//
// Returns:
//   allIds      — all collection IDs, sorted
//   toDelete    — IDs that will be deleted
//   toSkip      — IDs that are protected
//   counts      — map of id → doc count (null if count() failed)

export async function scanFirestore(db) {
  const all = await db.listCollections()
  const allIds = all.map((c) => c.id).sort()
  const toDelete = allIds.filter((id) => !PROTECTED_COLLECTIONS.has(id))
  const toSkip   = allIds.filter((id) =>  PROTECTED_COLLECTIONS.has(id))

  const counts = {}
  for (const id of allIds) {
    try {
      const snap = await db.collection(id).count().get()
      counts[id] = snap.data().count
    } catch {
      counts[id] = null
    }
  }

  return { allIds, toDelete, toSkip, counts }
}

// ── Delete ────────────────────────────────────────────────────────────────────
// Deletes each collection (including subcollections) using BulkWriter.
// Never touches any collection in PROTECTED_COLLECTIONS.
//
// Returns:
//   deletedCount      — number of collections successfully deleted
//   failedCollections — IDs that failed (can be re-run safely)

export async function deleteFirestoreCollections(db, toDelete, log = console.log) {
  let deletedCount = 0
  const failedCollections = []

  for (const collId of toDelete) {
    // Redundant guard — never delete a protected collection.
    if (PROTECTED_COLLECTIONS.has(collId)) {
      log(yellow(`  ⚠ Skipped protected collection: ${collId}`))
      continue
    }

    try {
      log(`  Deleting ${cyan(collId)} (+ subcollections)...`)

      const bulkWriter = db.bulkWriter()
      bulkWriter.onWriteError((error) => {
        log(yellow(`  ⚠ Retrying ${error.documentRef.path}: ${error.message}`))
        return true
      })

      await db.recursiveDelete(db.collection(collId), bulkWriter)
      await bulkWriter.close()

      log(green(`  ✓ ${collId}`))
      deletedCount++
    } catch (err) {
      log(red(`  ✗ ${collId}: ${err.message}`))
      failedCollections.push(collId)
    }
  }

  return { deletedCount, failedCollections }
}
