'use strict'
/**
 * clean-archive-test.cjs
 * Removes all test artifacts written by seed-archive-test + archiveAndCleanup.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npm run clean:archive-test
 *   (or)  node functions/scripts/clean-archive-test.cjs
 *
 * What it deletes:
 *   1. Firestore: applications/test-*  and  animals/test-*
 *   2. Firestore: archiveFiles docs whose applicationId or animalId matches test IDs
 *   3. Firestore: rejectionFlags docs whose archiveFileId matches a deleted archiveFile
 *   4. Storage:   private-pdfs/** PDFs at the three known test paths
 */

const { initializeApp } = require('firebase-admin/app')
const { getFirestore }  = require('firebase-admin/firestore')
const { getStorage }    = require('firebase-admin/storage')

// ── Safety ────────────────────────────────────────────────────────────────────
const PROJECT_ID = 'demo-upeva-test'
const BUCKET     = `${PROJECT_ID}.appspot.com`

if (process.env.ALLOW_REAL_PROJECT) {
  console.error('[clean] ERROR: ALLOW_REAL_PROJECT is set. Refusing.')
  process.exit(1)
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
}
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199'
}

// ── Known test IDs ────────────────────────────────────────────────────────────
const IDS = {
  APP_APPROVED:    'test-approved-001',
  APP_REJECTED:    'test-rejected-001',
  APP_WITHDRAWN:   'test-withdrawn-001',
  ANIMAL_ADOPTED:  'test-adopted-001',
  ANIMAL_ARCHIVED: 'test-archived-001',
}

const YEAR = new Date().getFullYear()

const EXPECTED_PDF_PATHS = [
  `private-pdfs/contracts/${YEAR}/contrato_${IDS.APP_APPROVED}_${YEAR}.pdf`,
  `private-pdfs/rejections/${YEAR}/rejeicao_${IDS.APP_REJECTED}_${YEAR}.pdf`,
  `private-pdfs/archived-animals/${YEAR}/animal_${IDS.ANIMAL_ARCHIVED}_${YEAR}.pdf`,
]

let deleted = 0
let skipped = 0
let errors  = 0

function ok(label)         { deleted++; console.log(`  ✓  deleted  ${label}`) }
function skip(label)       { skipped++; console.log(`  –  missing  ${label}`) }
function err(label, detail){ errors++;  console.log(`  ✗  error    ${label}`); if (detail) console.log(`       ${detail}`) }

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET })
  const db     = getFirestore()
  const bucket = getStorage().bucket()

  console.log('\n── Firestore: seed documents ────────────────────────────────')

  // 1. Original seed documents (may already be gone after archiveAndCleanup ran)
  for (const [col, id] of [
    ['applications', IDS.APP_APPROVED],
    ['applications', IDS.APP_REJECTED],
    ['applications', IDS.APP_WITHDRAWN],
    ['animals',      IDS.ANIMAL_ADOPTED],
    ['animals',      IDS.ANIMAL_ARCHIVED],
  ]) {
    try {
      const snap = await db.collection(col).doc(id).get()
      if (snap.exists) {
        await snap.ref.delete()
        ok(`${col}/${id}`)
      } else {
        skip(`${col}/${id}`)
      }
    } catch (e) {
      err(`${col}/${id}`, e.message)
    }
  }

  // 2. archiveFiles created by archiveAndCleanup
  console.log('\n── Firestore: archiveFiles ──────────────────────────────────')

  const archiveSnap = await db.collection('archiveFiles').get()
  const testAppIds  = new Set(Object.values(IDS).filter((id) => id.startsWith('test-')))
  const deletedArchiveIds = new Set()

  for (const doc of archiveSnap.docs) {
    const data = doc.data()
    const isTestArchive =
      (data.applicationId && testAppIds.has(data.applicationId)) ||
      (data.animalId      && testAppIds.has(data.animalId))      ||
      data.isTestData === true

    if (isTestArchive) {
      try {
        await doc.ref.delete()
        deletedArchiveIds.add(doc.id)
        ok(`archiveFiles/${doc.id}`)
      } catch (e) {
        err(`archiveFiles/${doc.id}`, e.message)
      }
    }
  }

  if (deletedArchiveIds.size === 0) {
    skip('archiveFiles (none matched test IDs)')
  }

  // 3. rejectionFlags whose archiveFileId was in deleted set
  console.log('\n── Firestore: rejectionFlags ────────────────────────────────')

  if (deletedArchiveIds.size > 0) {
    const flagsSnap = await db.collection('rejectionFlags').get()
    let flagsFound = 0

    for (const doc of flagsSnap.docs) {
      const data = doc.data()
      if (data.archiveFileId && deletedArchiveIds.has(data.archiveFileId)) {
        try {
          await doc.ref.delete()
          flagsFound++
          ok(`rejectionFlags/${doc.id}`)
        } catch (e) {
          err(`rejectionFlags/${doc.id}`, e.message)
        }
      }
    }

    if (flagsFound === 0) skip('rejectionFlags (none matched deleted archiveFileIds)')
  } else {
    skip('rejectionFlags (no archiveFiles were deleted to match against)')
  }

  // 4. Storage PDFs
  console.log('\n── Storage: private-pdfs ────────────────────────────────────')

  for (const path of EXPECTED_PDF_PATHS) {
    try {
      const [exists] = await bucket.file(path).exists()
      if (exists) {
        await bucket.file(path).delete()
        ok(`gs://${BUCKET}/${path}`)
      } else {
        skip(`gs://${BUCKET}/${path}`)
      }
    } catch (e) {
      err(`gs://${BUCKET}/${path}`, e.message)
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const total = deleted + skipped + errors
  console.log(`\n── Summary ──────────────────────────────────────────────────`)
  console.log(`  ${deleted} deleted   ${skipped} already gone   ${errors > 0 ? errors + ' errors' : '0 errors'}   (${total} items checked)`)

  if (errors > 0) {
    console.log('\n  Some items could not be deleted. Check the errors above.\n')
    process.exit(1)
  } else {
    console.log('\n  Emulator state is clean. Re-run seed:archive-test to start fresh.\n')
  }
}

run().catch((err) => {
  console.error('[clean] Fatal error:', err.message || err)
  process.exit(1)
})
