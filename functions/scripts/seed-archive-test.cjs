'use strict'
/**
 * seed-archive-test.cjs
 * Creates five clearly-fake, expired Firestore documents in the LOCAL EMULATOR so that
 * archiveAndCleanup can be triggered and the full private-PDF-archive flow verified.
 *
 * Safety guards:
 *  - Hard-codes the demo project ID (demo-upeva-test) — never connects to upevapets.
 *  - Requires FIRESTORE_EMULATOR_HOST to be reachable before writing anything.
 *  - Refuses to run if the env var ALLOW_REAL_PROJECT is set (footgun prevention).
 *  - All documents carry isTestData:true so the clean script can remove them.
 *
 * Usage:
 *   npm run seed:archive-test
 *   (or)  node functions/scripts/seed-archive-test.cjs
 *
 * Prerequisites:
 *   firebase emulators:start --only auth,firestore,functions,storage
 *   cp functions/.secret.local.example functions/.secret.local   # first time only
 */

const { createCipheriv, randomBytes } = require('crypto')
const { readFileSync, existsSync } = require('fs')
const { resolve } = require('path')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

// ── Safety: never connect to the real project ─────────────────────────────────
const PROJECT_ID = 'demo-upeva-test'

if (process.env.ALLOW_REAL_PROJECT) {
  console.error('[seed] ERROR: ALLOW_REAL_PROJECT is set. Refusing to run against a real project.')
  process.exit(1)
}

// Default emulator host if not already exported
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
  console.log(`[seed] FIRESTORE_EMULATOR_HOST not set — defaulting to 127.0.0.1:8080`)
}

// ── Well-known test document IDs ──────────────────────────────────────────────
const IDS = {
  APP_APPROVED:  'test-approved-001',
  APP_REJECTED:  'test-rejected-001',
  APP_WITHDRAWN: 'test-withdrawn-001',
  ANIMAL_ADOPTED:  'test-adopted-001',
  ANIMAL_ARCHIVED: 'test-archived-001',
}

const YEAR = new Date().getFullYear()

// ── Load encryption key ───────────────────────────────────────────────────────
function loadPiiKey() {
  if (process.env.PII_ENCRYPTION_KEY) return process.env.PII_ENCRYPTION_KEY

  const secretPath = resolve(__dirname, '..', '.secret.local')
  if (existsSync(secretPath)) {
    for (const line of readFileSync(secretPath, 'utf8').split('\n')) {
      const m = line.match(/^PII_ENCRYPTION_KEY=(.+)$/)
      if (m) return m[1].trim()
    }
  }

  console.error(
    '\n[seed] ERROR: PII_ENCRYPTION_KEY not found.\n\n' +
    'Option 1 — use the example key for local testing:\n' +
    '  cp functions/.secret.local.example functions/.secret.local\n\n' +
    'Option 2 — export the env var:\n' +
    '  export PII_ENCRYPTION_KEY=<64-hex-chars>\n'
  )
  process.exit(1)
}

// ── AES-256-GCM encryption (matches crypto.util.ts) ──────────────────────────
function encrypt(text, keyHex) {
  const key = Buffer.from(keyHex, 'hex')
  const iv  = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag   = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

// ── Timestamps ────────────────────────────────────────────────────────────────
const THIRTY_ONE_DAYS_AGO = Timestamp.fromDate(
  new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
)
const NOW = Timestamp.now()

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const piiKey = loadPiiKey()

  initializeApp({ projectId: PROJECT_ID })
  const db = getFirestore()

  const encCpf     = encrypt('000.000.000-00', piiKey)
  const encPhone   = encrypt('(00) 00000-0000', piiKey)
  const encBirth   = encrypt('2000-01-01', piiKey)
  const encAddress = encrypt(JSON.stringify({
    street: 'Rua Teste',
    number: '0',
    complement: 'Emulador',
    neighborhood: 'Centro',
    city: 'Flores da Cunha',
    state: 'RS',
  }), piiKey)

  const batch = db.batch()

  // 1. Approved application (> 30 days old) linked to adopted animal
  batch.set(db.collection('applications').doc(IDS.APP_APPROVED), {
    status: 'approved',
    animalId: IDS.ANIMAL_ADOPTED,
    animalName: '[TEST] Bolinha',
    species: 'dog',
    fullName: '[TEST] Adotante Fictício',
    email: 'test-archive@example.invalid',
    cpf: encCpf,
    phone: encPhone,
    birthDate: encBirth,
    address: encAddress,
    reviewedByLabel: 'Tester Admin',
    reviewedAt: THIRTY_ONE_DAYS_AGO,
    updatedAt: THIRTY_ONE_DAYS_AGO,
    createdAt: THIRTY_ONE_DAYS_AGO,
    isTestData: true,
    testNote: 'seed-archive-test — approved application for contract PDF',
  })

  // 2. Adopted animal with empty photos (safe for Storage cleanup)
  batch.set(db.collection('animals').doc(IDS.ANIMAL_ADOPTED), {
    name: '[TEST] Bolinha',
    species: 'dog',
    sex: 'male',
    size: 'medium',
    status: 'adopted',
    adoptedApplicationId: IDS.APP_APPROVED,
    photos: [],
    createdAt: THIRTY_ONE_DAYS_AGO,
    updatedAt: THIRTY_ONE_DAYS_AGO,
    isTestData: true,
    testNote: 'seed-archive-test — adopted animal linked to approved application',
  })

  // 3. Rejected application with pendingExport:true
  batch.set(db.collection('applications').doc(IDS.APP_REJECTED), {
    status: 'rejected',
    pendingExport: true,
    animalName: '[TEST] Mingau',
    species: 'cat',
    fullName: '[TEST] Candidato Fictício',
    email: 'test-archive-rejected@example.invalid',
    cpf: encCpf,
    phone: encPhone,
    birthDate: encBirth,
    address: encAddress,
    rejectionReason: 'inadequate_housing',
    rejectionDetails:
      'Registro de rejeição de teste para validação do fluxo de arquivo PDF privado. ' +
      'Este documento foi gerado pelo script seed-archive-test e não contém dados reais.',
    reviewedByLabel: 'Tester Admin',
    reviewedAt: NOW,
    updatedAt: NOW,
    createdAt: NOW,
    isTestData: true,
    testNote: 'seed-archive-test — rejected application for rejection PDF + rejectionFlag',
  })

  // 4. Withdrawn application (> 30 days old) — cron deletes silently, no PDF
  batch.set(db.collection('applications').doc(IDS.APP_WITHDRAWN), {
    status: 'withdrawn',
    species: 'dog',
    fullName: '[TEST] Desistente Fictício',
    email: 'test-archive-withdrawn@example.invalid',
    updatedAt: THIRTY_ONE_DAYS_AGO,
    createdAt: THIRTY_ONE_DAYS_AGO,
    isTestData: true,
    testNote: 'seed-archive-test — withdrawn application for silent deletion',
  })

  // 5. Archived animal (> 30 days old) with empty photos
  batch.set(db.collection('animals').doc(IDS.ANIMAL_ARCHIVED), {
    name: '[TEST] Gardênia',
    species: 'cat',
    sex: 'female',
    size: 'small',
    status: 'archived',
    archiveReason: 'other',
    archiveDetails:
      'Animal de teste para validação do fluxo de arquivo PDF privado. ' +
      'Este registro foi gerado pelo script seed-archive-test e não representa um caso real.',
    archiveDate: `${YEAR - 0}-01-15`,
    archivedAt: THIRTY_ONE_DAYS_AGO,
    archivedByLabel: 'Tester Admin',
    photos: [],
    createdAt: THIRTY_ONE_DAYS_AGO,
    updatedAt: THIRTY_ONE_DAYS_AGO,
    isTestData: true,
    testNote: 'seed-archive-test — archived animal for archivedAnimal PDF',
  })

  await batch.commit()

  console.log('\n[seed] ✓ 5 test documents written to Firestore emulator\n')
  console.log('  applications/' + IDS.APP_APPROVED  + '  (approved, updatedAt 31d ago)')
  console.log('  applications/' + IDS.APP_REJECTED  + '  (rejected, pendingExport:true)')
  console.log('  applications/' + IDS.APP_WITHDRAWN + '  (withdrawn, updatedAt 31d ago)')
  console.log('  animals/'      + IDS.ANIMAL_ADOPTED  + '  (adopted, photos:[])')
  console.log('  animals/'      + IDS.ANIMAL_ARCHIVED + '  (archived, archivedAt 31d ago)')

  console.log('\n[seed] Expected PDF paths after archiveAndCleanup runs:')
  console.log(`  private-pdfs/contracts/      ${YEAR}/contrato_${IDS.APP_APPROVED}_${YEAR}.pdf`)
  console.log(`  private-pdfs/rejections/     ${YEAR}/rejeicao_${IDS.APP_REJECTED}_${YEAR}.pdf`)
  console.log(`  private-pdfs/archived-animals/${YEAR}/animal_${IDS.ANIMAL_ARCHIVED}_${YEAR}.pdf`)

  console.log('\n[seed] Next step — trigger archiveAndCleanup in the emulator:')
  console.log(`  curl -sS -X POST \\`)
  console.log(`    "http://127.0.0.1:5001/demo-upeva-test/southamerica-east1/archiveAndCleanup"`)
  console.log(`  # or use the Emulator UI at http://localhost:4000 → Functions → Run\n`)
}

run().catch((err) => {
  console.error('[seed] Fatal error:', err.message || err)
  process.exit(1)
})
