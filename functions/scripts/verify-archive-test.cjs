'use strict'
/**
 * verify-archive-test.cjs
 * Checks the emulator state AFTER archiveAndCleanup has been triggered.
 * Reports pass/fail for each expected outcome.
 *
 * Usage:
 *   npm run verify:archive-test
 *   (or)  node functions/scripts/verify-archive-test.cjs
 *
 * What it checks:
 *   1. archiveFiles documents created (contract, rejection, archivedAnimal)
 *   2. rejectionFlags doc has archiveFileId pointing to the rejection archiveFile
 *   3. Original application / animal docs are deleted
 *   4. withdrawn application is deleted (no archiveFile)
 *   5. Storage PDFs exist at expected private-pdfs/** paths
 *
 * Does NOT check:
 *   - PDF content (opening the PDF is done via getArchiveFileUrl callable from the admin UI)
 *   - getArchiveFileUrl auth enforcement (covered by Firestore rules tests)
 */

const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')

// ── Safety ────────────────────────────────────────────────────────────────────
const PROJECT_ID = 'demo-upeva-test'
const BUCKET     = `${PROJECT_ID}.appspot.com`

if (process.env.ALLOW_REAL_PROJECT) {
  console.error('[verify] ERROR: ALLOW_REAL_PROJECT is set. Refusing.')
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
  APP_APPROVED:  'test-approved-001',
  APP_REJECTED:  'test-rejected-001',
  APP_WITHDRAWN: 'test-withdrawn-001',
  ANIMAL_ADOPTED:  'test-adopted-001',
  ANIMAL_ARCHIVED: 'test-archived-001',
}

const YEAR = new Date().getFullYear()

const EXPECTED_PDF_PATHS = {
  contract:      `private-pdfs/contracts/${YEAR}/contrato_${IDS.APP_APPROVED}_${YEAR}.pdf`,
  rejection:     `private-pdfs/rejections/${YEAR}/rejeicao_${IDS.APP_REJECTED}_${YEAR}.pdf`,
  archivedAnimal:`private-pdfs/archived-animals/${YEAR}/animal_${IDS.ANIMAL_ARCHIVED}_${YEAR}.pdf`,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
let warnings = 0

function pass(label) {
  passed++
  console.log(`  ✓  ${label}`)
}

function fail(label, detail) {
  failed++
  console.log(`  ✗  ${label}`)
  if (detail) console.log(`       ${detail}`)
}

function warn(label, detail) {
  warnings++
  console.log(`  ⚠  ${label}`)
  if (detail) console.log(`       ${detail}`)
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET })
  const db      = getFirestore()
  const bucket  = getStorage().bucket()

  // ── 1. archiveFiles documents ─────────────────────────────────────────────
  section('archiveFiles — Firestore')

  const archiveSnap = await db.collection('archiveFiles').get()
  const allArchives = archiveSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const contractFile      = allArchives.find((a) => a.applicationId === IDS.APP_APPROVED  && a.type === 'contract')
  const rejectionFile     = allArchives.find((a) => a.applicationId === IDS.APP_REJECTED  && a.type === 'rejection')
  const archivedAnimalFile= allArchives.find((a) => a.animalId      === IDS.ANIMAL_ARCHIVED && a.type === 'archivedAnimal')

  if (contractFile) {
    pass(`archiveFiles — contract found (id: ${contractFile.id})`)
    if (contractFile.storagePath === EXPECTED_PDF_PATHS.contract)
      pass(`  storagePath matches expected path`)
    else
      fail(`  storagePath mismatch`, `got: ${contractFile.storagePath}`)
    if (contractFile.contentType === 'application/pdf')
      pass(`  contentType = application/pdf`)
    else
      fail(`  contentType wrong`, `got: ${contractFile.contentType}`)
    if (contractFile.sizeBytes > 0)
      pass(`  sizeBytes > 0 (${contractFile.sizeBytes} bytes)`)
    else
      fail(`  sizeBytes is 0 or missing`)
    if (!contractFile.cpf && !contractFile.phone && !contractFile.address && !contractFile.birthDate)
      pass(`  no PII fields (cpf/phone/address/birthDate) in archiveFile`)
    else
      fail(`  PII field detected in archiveFile — review what is stored`)
    if (contractFile.status === 'stored')
      pass(`  status = "stored"`)
    else
      fail(`  status wrong`, `got: ${contractFile.status}`)
  } else {
    fail(`archiveFiles — contract NOT found for applicationId=${IDS.APP_APPROVED}`)
    console.log('     Has archiveAndCleanup run yet? Try:')
    console.log('       curl -sS -X POST http://127.0.0.1:5001/demo-upeva-test/southamerica-east1/archiveAndCleanup')
  }

  if (rejectionFile) {
    pass(`archiveFiles — rejection found (id: ${rejectionFile.id})`)
    if (rejectionFile.storagePath === EXPECTED_PDF_PATHS.rejection)
      pass(`  storagePath matches expected path`)
    else
      fail(`  storagePath mismatch`, `got: ${rejectionFile.storagePath}`)
    if (!rejectionFile.cpf && !rejectionFile.phone && !rejectionFile.rejectionDetails)
      pass(`  no PII fields (cpf/phone/rejectionDetails) in archiveFile`)
    else
      fail(`  PII/sensitive field detected in archiveFile`)
  } else {
    fail(`archiveFiles — rejection NOT found for applicationId=${IDS.APP_REJECTED}`)
  }

  if (archivedAnimalFile) {
    pass(`archiveFiles — archivedAnimal found (id: ${archivedAnimalFile.id})`)
    if (archivedAnimalFile.storagePath === EXPECTED_PDF_PATHS.archivedAnimal)
      pass(`  storagePath matches expected path`)
    else
      fail(`  storagePath mismatch`, `got: ${archivedAnimalFile.storagePath}`)
  } else {
    fail(`archiveFiles — archivedAnimal NOT found for animalId=${IDS.ANIMAL_ARCHIVED}`)
  }

  // ── 2. rejectionFlags ─────────────────────────────────────────────────────
  section('rejectionFlags — Firestore')

  const flagsSnap = await db.collection('rejectionFlags').get()
  const flags = flagsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const flagWithArchive = flags.find((f) => typeof f.archiveFileId === 'string' && f.archiveFileId.length > 0)

  if (flagWithArchive) {
    pass(`rejectionFlags — doc found with archiveFileId (flag id: ${flagWithArchive.id.slice(0,12)}…)`)
    if (rejectionFile && flagWithArchive.archiveFileId === rejectionFile.id)
      pass(`  archiveFileId points to the correct archiveFiles doc`)
    else if (rejectionFile)
      fail(`  archiveFileId does not match rejection archiveFile id`,
           `flag.archiveFileId=${flagWithArchive.archiveFileId}, expected=${rejectionFile?.id}`)
    else
      warn(`  cannot validate archiveFileId (rejectionFile not found above)`)

    if (!flagWithArchive.driveUrl)
      pass(`  no driveUrl field (Drive dependency removed)`)
    else
      fail(`  driveUrl still present — Drive migration incomplete`)

    if (!flagWithArchive.cpf && !flagWithArchive.email && !flagWithArchive.phone)
      pass(`  no plaintext PII in rejectionFlag`)
    else
      fail(`  plaintext PII detected in rejectionFlag`)
  } else {
    fail(`rejectionFlags — no doc with archiveFileId found`)
    if (flags.length > 0)
      console.log(`     ${flags.length} flag(s) exist but none have archiveFileId set`)
  }

  // ── 3. Original docs deleted ──────────────────────────────────────────────
  section('Original docs deleted after archiving')

  for (const [label, col, id] of [
    ['approved application',  'applications', IDS.APP_APPROVED],
    ['rejected application',  'applications', IDS.APP_REJECTED],
    ['withdrawn application', 'applications', IDS.APP_WITHDRAWN],
    ['adopted animal',        'animals',      IDS.ANIMAL_ADOPTED],
    ['archived animal',       'animals',      IDS.ANIMAL_ARCHIVED],
  ]) {
    const snap = await db.collection(col).doc(id).get()
    if (!snap.exists) {
      pass(`${label} (${col}/${id}) deleted`)
    } else {
      fail(`${label} (${col}/${id}) still exists — cron may not have run yet, or archive failed`)
    }
  }

  // ── 4. Storage PDFs ───────────────────────────────────────────────────────
  section('Storage — private-pdfs/** (requires Storage emulator)')

  for (const [type, path] of Object.entries(EXPECTED_PDF_PATHS)) {
    try {
      const [exists] = await bucket.file(path).exists()
      if (exists) {
        pass(`PDF exists: ${path}`)
        try {
          const [meta] = await bucket.file(path).getMetadata()
          if (meta.contentType === 'application/pdf')
            pass(`  contentType = application/pdf`)
          else
            fail(`  contentType wrong`, `got: ${meta.contentType}`)
          const cc = meta.metadata?.cacheControl ?? meta.cacheControl
          if (cc && cc.includes('private') && cc.includes('no-store'))
            pass(`  Cache-Control: ${cc}`)
          else
            fail(`  Cache-Control missing "private, no-store"`, `got: ${cc}`)
        } catch (metaErr) {
          warn(`  could not read metadata`, metaErr.message)
        }
      } else {
        fail(`PDF not found in Storage: ${path}`)
      }
    } catch (storageErr) {
      warn(`Storage check failed for ${type} — is FIREBASE_STORAGE_EMULATOR_HOST set?`, storageErr.message)
    }
  }

  // ── 5. private-pdfs not client-readable (rule-level, not checked here) ────
  section('Security notes')

  console.log('  ℹ  private-pdfs direct client access: blocked by Storage rules (allow read,write:if false)')
  console.log('     Covered by: npm run test:rules (storage.rules.test.ts)')
  console.log('  ℹ  archiveFiles public read: blocked by Firestore rules (isStaff() only)')
  console.log('     Covered by: npm run test:rules (firestore.rules.test.ts)')
  console.log('  ℹ  getArchiveFileUrl: admin/reviewer only, storagePath prefix guard')
  console.log('     Manual test: open /admin/arquivos in the dev app, click "Abrir PDF"')

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = passed + failed + warnings
  console.log(`\n── Summary ${'─'.repeat(41)}`)
  console.log(`  ${passed}/${total} passed   ${failed > 0 ? failed + ' failed' : '0 failed'}   ${warnings > 0 ? warnings + ' warnings' : '0 warnings'}`)

  if (failed > 0) {
    console.log('\n  If archiveAndCleanup has not run yet, trigger it:')
    console.log('    curl -sS -X POST \\')
    console.log('      "http://127.0.0.1:5001/demo-upeva-test/southamerica-east1/archiveAndCleanup"\n')
    process.exit(1)
  } else {
    console.log('\n  All checks passed. Run npm run clean:archive-test to remove test artifacts.\n')
  }
}

run().catch((err) => {
  console.error('[verify] Fatal error:', err.message || err)
  process.exit(1)
})
