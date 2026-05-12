/**
 * Callable-function emulator tests.
 *
 * Run with:
 *   npm run test:functions
 *
 * Requires emulators: auth, firestore, functions, storage (started by the script above).
 * Functions must be compiled (the script runs `npm --prefix functions run build` first).
 * Test secrets are loaded by the emulator from functions/.env.local.
 */

import { createCipheriv, createHmac, randomBytes } from 'node:crypto'
import { initializeApp as initAdminApp, deleteApp as deleteAdminApp, type App as AdminApp } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getFirestore as getAdminFirestore, Timestamp } from 'firebase-admin/firestore'
import { getStorage as getAdminStorage } from 'firebase-admin/storage'
import { initializeApp as initClientApp, deleteApp as deleteClientApp, type FirebaseApp } from 'firebase/app'
import { getAuth as getClientAuth, connectAuthEmulator, signInWithCustomToken, signOut } from 'firebase/auth'
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_ID = 'demo-upeva-test'
const STORAGE_BUCKET = `${PROJECT_ID}.appspot.com`
const REGION = 'southamerica-east1'

// Emulator hosts — injected by `firebase emulators:exec` as env vars.
// Fallback to defaults so tests can be run directly if emulators are already up.
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'
const FUNCTIONS_PORT = 5001

// These MUST match PII_ENCRYPTION_KEY / HMAC_SECRET_KEY in functions/.env.local
const TEST_PII_KEY = Buffer.from(
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'hex',
)
const TEST_HMAC_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'

// ── Crypto helpers (mirror production crypto.util.ts with fixed test keys) ────

function testEncrypt(text: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', TEST_PII_KEY, iv, { authTagLength: 16 })
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

function testHmac(text: string): string {
  return createHmac('sha256', TEST_HMAC_KEY).update(text, 'utf8').digest('hex')
}

/** Normalize CPF to 11 digits (no separators) for privacy index. */
function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

// ── Valid CPFs (checksum verified) ────────────────────────────────────────────
// 123.456.789-09 and 529.982.247-25 are arithmetically valid CPFs used only in tests.
const VALID_CPF_1 = '123.456.789-09'
const VALID_CPF_2 = '529.982.247-25'

// ── Minimal valid application payload ─────────────────────────────────────────

type PartialApp = Record<string, unknown>

function baseApplication(overrides: PartialApp = {}): PartialApp {
  return {
    species: 'cat',
    fullName: 'Test Applicant',
    email: 'applicant@test.example',
    cpf: VALID_CPF_1,
    phone: '(11) 91234-5678',
    birthDate: '1990-01-01',
    cep: '01310-100',
    address: {
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    adultsCount: 2,
    childrenCount: 0,
    adoptionReason: 'I want to give a cat a loving home and care for it.',
    hoursHomePeoplePerDay: 8,
    housingType: 'apartment_with_screens',
    isRented: false,
    hadPetsBefore: false,
    hasCurrentPets: false,
    canAffordCosts: true,
    scratchBehaviorResponse: 'I will use deterrents and trim nails.',
    escapeResponse: 'I will keep all windows and doors closed.',
    cannotKeepResponse: 'I will find a responsible new family.',
    longTermCommitment: true,
    acceptsReturnPolicy: true,
    acceptsCastrationPolicy: true,
    acceptsFollowUp: true,
    acceptsNoResale: true,
    acceptsLiabilityTerms: true,
    acceptsResponsibility: true,
    // Cat general interest requires these:
    preferredSex: 'any',
    jointAdoption: false,
    isGift: false,
    ...overrides,
  }
}

/** Payload for a specific-animal application (removes general-interest-only fields). */
function specificAnimalApplication(animalId: string, overrides: PartialApp = {}): PartialApp {
  const base = baseApplication(overrides)
  // preferredSex / jointAdoption are general-interest-only; isGift is still required for cats
  delete base.preferredSex
  delete base.jointAdoption
  return { ...base, animalId, animalName: 'Test Cat' }
}

/** Minimal application doc with encrypted PII for admin-seeded setup. */
function encryptedApplicationDoc(overrides: PartialApp = {}): PartialApp {
  return {
    species: 'cat',
    fullName: 'Test Applicant',
    email: 'applicant@test.example',
    cep: '01310-100',
    cpf: testEncrypt(VALID_CPF_1),
    phone: testEncrypt('(11) 91234-5678'),
    birthDate: testEncrypt('1990-01-01'),
    address: testEncrypt(
      JSON.stringify({
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      }),
    ),
    privacyIndex: {
      cpfHash: testHmac(normalizeCpf(VALID_CPF_1)),
      emailHash: testHmac('applicant@test.example'),
    },
    adultsCount: 2,
    childrenCount: 0,
    adoptionReason: 'I want to give a cat a loving home.',
    hoursHomePeoplePerDay: 8,
    housingType: 'apartment_with_screens',
    isRented: false,
    hadPetsBefore: false,
    hasCurrentPets: false,
    canAffordCosts: true,
    scratchBehaviorResponse: 'Use deterrents.',
    escapeResponse: 'Keep doors closed.',
    cannotKeepResponse: 'Find new home.',
    longTermCommitment: true,
    acceptsReturnPolicy: true,
    acceptsCastrationPolicy: true,
    acceptsFollowUp: true,
    acceptsNoResale: true,
    acceptsLiabilityTerms: true,
    acceptsResponsibility: true,
    waitlistEntry: false,
    queuePosition: 1,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  }
}

function availableAnimalDoc(overrides: PartialApp = {}): PartialApp {
  return {
    name: 'Test Cat',
    species: 'cat',
    sex: 'female',
    status: 'available',
    breed: 'SRD',
    coatColor: 'orange',
    neutered: true,
    activeApplicationCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  }
}

// ── Firebase SDK instances ────────────────────────────────────────────────────

let adminApp: AdminApp
let clientApp: FirebaseApp

// Convenience accessors — assigned in beforeAll
let adminDb: ReturnType<typeof getAdminFirestore>
let adminAuth: ReturnType<typeof getAdminAuth>
let adminStorage: ReturnType<typeof getAdminStorage>

// ── Emulator REST helpers ─────────────────────────────────────────────────────

async function clearFirestoreEmulator(): Promise<void> {
  await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
}

async function clearStorageEmulator(): Promise<void> {
  await fetch(
    `http://127.0.0.1:9199/emulator/v1/b/${STORAGE_BUCKET}/o`,
    { method: 'DELETE' },
  )
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Create (or recreate) a test user with the given role, then sign the client
 * SDK in as that user so httpsCallable picks up the token automatically.
 */
async function signInAs(role: 'admin' | 'reviewer'): Promise<void> {
  const uid = `test-${role}`
  // Ignore errors — user may not exist yet
  await adminAuth.deleteUser(uid).catch(() => undefined)
  await adminAuth.createUser({ uid, email: `${uid}@test.example`, password: 'pw-test' })
  await adminAuth.setCustomUserClaims(uid, { role })
  const customToken = await adminAuth.createCustomToken(uid, { role })
  await signInWithCustomToken(getClientAuth(clientApp), customToken)
}

async function signInAsAdmin(): Promise<void> {
  return signInAs('admin')
}

async function signInAsReviewer(): Promise<void> {
  return signInAs('reviewer')
}

async function signOutClient(): Promise<void> {
  await signOut(getClientAuth(clientApp)).catch(() => undefined)
}

// ── Callable helper ───────────────────────────────────────────────────────────

function callable(name: string) {
  const fns = getFunctions(clientApp, REGION)
  return httpsCallable(fns, name)
}

async function waitFor(
  assertion: () => Promise<void>,
  timeoutMs: number = 10_000,
): Promise<void> {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await assertion()
      return
    } catch (err) {
      lastError = err
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  throw lastError
}

// ── Global setup / teardown ───────────────────────────────────────────────────

beforeAll(() => {
  // Admin SDK — emulator env vars set by `firebase emulators:exec`
  adminApp = initAdminApp({
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
  })
  adminDb = getAdminFirestore(adminApp)
  adminAuth = getAdminAuth(adminApp)
  adminStorage = getAdminStorage(adminApp)

  // Client SDK
  clientApp = initClientApp(
    { apiKey: 'fake-api-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` },
    'test-client',
  )
  const clientAuth = getClientAuth(clientApp)
  const clientFns = getFunctions(clientApp, REGION)
  connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true })
  connectFunctionsEmulator(clientFns, '127.0.0.1', FUNCTIONS_PORT)
})

afterAll(async () => {
  await signOutClient()
  await deleteClientApp(clientApp).catch(() => undefined)
  await deleteAdminApp(adminApp).catch(() => undefined)
})

// ── Suite 1: createApplication ────────────────────────────────────────────────

describe('createApplication', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator()
    await signOutClient()
  })

  it('unauthenticated public caller can create a valid cat application', async () => {
    const result = await callable('createApplication')(baseApplication())
    const data = result.data as { id: string; waitlistEntry: boolean; queuePosition: number }
    expect(typeof data.id).toBe('string')
    expect(data.id.length).toBeGreaterThan(0)
    expect(data.queuePosition).toBe(0) // general-interest, no queue
  })

  it('rejects an invalid CPF', async () => {
    await expect(
      callable('createApplication')(baseApplication({ cpf: '000.000.000-00' })),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('rejects a malformed CPF format', async () => {
    await expect(
      callable('createApplication')(baseApplication({ cpf: '12345678909' })),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('rejects an invalid email', async () => {
    await expect(
      callable('createApplication')(baseApplication({ email: 'not-an-email' })),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('rejects an invalid phone', async () => {
    await expect(
      callable('createApplication')(baseApplication({ phone: '11912345678' })),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('rejects an invalid CEP', async () => {
    await expect(
      callable('createApplication')(baseApplication({ cep: '1234567' })),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('specific-animal application against an available animal succeeds with queuePosition 1', async () => {
    await adminDb.collection('animals').doc('cat-available').set(availableAnimalDoc())

    const result = await callable('createApplication')(
      specificAnimalApplication('cat-available'),
    )
    const data = result.data as { id: string; queuePosition: number; waitlistEntry: boolean }
    expect(data.queuePosition).toBe(1)
    expect(data.waitlistEntry).toBe(false)

    const appDoc = await adminDb.collection('applications').doc(data.id).get()
    expect(appDoc.data()?.animalId).toBe('cat-available')
    expect(appDoc.data()?.status).toBe('pending')
  })

  it('public cat application with jointAdoption preference and single animalId does not link a second animal', async () => {
    // jointAdoption is a preference/consent only — the public form never selects a second cat.
    // The Upeva team assigns any second cat later during the admin review flow.
    await adminDb.collection('animals').doc('cat-joint-pref').set(availableAnimalDoc({ name: 'Solo Cat' }))

    const result = await callable('createApplication')({
      ...specificAnimalApplication('cat-joint-pref'),
      jointAdoption: true,
    })
    const data = result.data as { id: string; queuePosition: number; waitlistEntry: boolean }
    expect(data.queuePosition).toBe(1)
    expect(data.waitlistEntry).toBe(false)

    const [appDoc, animalDoc] = await Promise.all([
      adminDb.collection('applications').doc(data.id).get(),
      adminDb.collection('animals').doc('cat-joint-pref').get(),
    ])
    expect(appDoc.data()?.jointAdoption).toBe(true)             // preference stored
    expect(appDoc.data()?.animalId).toBe('cat-joint-pref')      // primary animal linked
    expect(appDoc.data()?.animalIds).toEqual(['cat-joint-pref']) // only one animal, never two
    expect(animalDoc.data()?.activeApplicationCount).toBe(1)    // only one animal queued
  })

  it('rejects joint adoption with dogs', async () => {
    await adminDb.collection('animals').doc('dog-joint-a').set(
      availableAnimalDoc({ name: 'Dog A', species: 'dog', size: 'medium' }),
    )
    await adminDb.collection('animals').doc('dog-joint-b').set(
      availableAnimalDoc({ name: 'Dog B', species: 'dog', size: 'medium' }),
    )

    await expect(
      callable('createApplication')({
        ...specificAnimalApplication('dog-joint-a', { species: 'dog', animalName: 'Dog A' }),
        animalIds: ['dog-joint-a', 'dog-joint-b'],
      }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('rejects applications with more than two animals', async () => {
    await expect(
      callable('createApplication')({
        ...specificAnimalApplication('cat-one'),
        animalIds: ['cat-one', 'cat-two', 'cat-three'],
      }),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('specific-animal application against adopted animal is rejected', async () => {
    await adminDb.collection('animals').doc('cat-adopted').set(availableAnimalDoc({ status: 'adopted' }))

    await expect(
      callable('createApplication')(specificAnimalApplication('cat-adopted')),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('specific-animal application against archived animal is rejected', async () => {
    await adminDb.collection('animals').doc('cat-archived').set(availableAnimalDoc({ status: 'archived' }))

    await expect(
      callable('createApplication')(specificAnimalApplication('cat-archived')),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('two sequential applications for the same animal get queue positions 1 and 2', async () => {
    await adminDb.collection('animals').doc('cat-queue').set(availableAnimalDoc())

    const r1 = await callable('createApplication')(
      specificAnimalApplication('cat-queue', { cpf: VALID_CPF_1, email: 'q1@test.example' }),
    )
    const r2 = await callable('createApplication')(
      specificAnimalApplication('cat-queue', { cpf: VALID_CPF_2, email: 'q2@test.example' }),
    )

    const d1 = r1.data as { queuePosition: number }
    const d2 = r2.data as { queuePosition: number }
    expect(d1.queuePosition).toBe(1)
    expect(d2.queuePosition).toBe(2)
  })

  it('persists privacyIndex with cpfHash and emailHash', async () => {
    const result = await callable('createApplication')(baseApplication())
    const { id } = result.data as { id: string }

    const doc = await adminDb.collection('applications').doc(id).get()
    const pi = doc.data()?.privacyIndex as Record<string, unknown>
    expect(typeof pi?.cpfHash).toBe('string')
    expect(pi?.cpfHash).toHaveLength(64) // SHA-256 hex
    expect(typeof pi?.emailHash).toBe('string')
    expect(pi?.emailHash).toHaveLength(64)
    // Hashes must not equal the plaintext values
    expect(pi?.cpfHash).not.toBe(VALID_CPF_1)
    expect(pi?.emailHash).not.toBe('applicant@test.example')
  })

  it('stores cpf, phone, birthDate, and address encrypted — not in plaintext', async () => {
    const result = await callable('createApplication')(baseApplication())
    const { id } = result.data as { id: string }

    const raw = (await adminDb.collection('applications').doc(id).get()).data() ?? {}

    // Each encrypted field must be a string in iv:authTag:ciphertext hex format
    for (const field of ['cpf', 'phone', 'birthDate', 'address']) {
      const val = raw[field]
      expect(typeof val).toBe('string')
      const parts = (val as string).split(':')
      expect(parts).toHaveLength(3) // iv:authTag:ciphertext
      parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]+$/))
    }

    // Plaintext values must not appear in stored fields
    expect(raw.cpf).not.toBe(VALID_CPF_1)
    expect(raw.phone).not.toBe('(11) 91234-5678')
    expect(raw.birthDate).not.toBe('1990-01-01')
    expect(typeof raw.address).not.toBe('object') // stored as string, not parsed
  })
})

// ── Suite 2: updateApplicationReview ─────────────────────────────────────────

describe('updateApplicationReview', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator()
    await clearStorageEmulator()
    await signOutClient()
  })

  it('non-staff caller is denied', async () => {
    // Sign in as a user with no role claim (only uid, no role)
    const uid = 'no-role-user'
    await adminAuth.deleteUser(uid).catch(() => undefined)
    await adminAuth.createUser({ uid, email: 'norole@test.example' })
    // No custom claims — role is undefined
    const token = await adminAuth.createCustomToken(uid)
    await signInWithCustomToken(getClientAuth(clientApp), token)

    await adminDb.collection('applications').doc('app-1').set(encryptedApplicationDoc())

    await expect(
      callable('updateApplicationReview')({ id: 'app-1', status: 'in_review' }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' })
  })

  it('reviewer can move a pending application to in_review', async () => {
    await signInAsReviewer()
    await adminDb.collection('applications').doc('app-pending').set(encryptedApplicationDoc())

    const result = await callable('updateApplicationReview')({
      id: 'app-pending',
      status: 'in_review',
    })
    expect((result.data as { success: boolean }).success).toBe(true)

    const doc = await adminDb.collection('applications').doc('app-pending').get()
    expect(doc.data()?.status).toBe('in_review')
  })

  it('admin approval marks application approved and animal adopted', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-for-approval').set(availableAnimalDoc())
    await adminDb.collection('applications').doc('app-for-approval').set(
      encryptedApplicationDoc({ animalId: 'cat-for-approval', animalName: 'Test Cat', status: 'in_review' }),
    )

    await callable('updateApplicationReview')({
      id: 'app-for-approval',
      status: 'approved',
    })

    const [appDoc, animalDoc] = await Promise.all([
      adminDb.collection('applications').doc('app-for-approval').get(),
      adminDb.collection('animals').doc('cat-for-approval').get(),
    ])

    expect(appDoc.data()?.status).toBe('approved')
    expect(animalDoc.data()?.status).toBe('adopted')
    expect(animalDoc.data()?.adoptedApplicationId).toBe('app-for-approval')
  })

  it('admin approval of a joint cat application marks both cats adopted', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-approval-a').set(availableAnimalDoc({ name: 'Approval A' }))
    await adminDb.collection('animals').doc('cat-approval-b').set(availableAnimalDoc({ name: 'Approval B' }))
    await adminDb.collection('applications').doc('app-joint-approval').set(
      encryptedApplicationDoc({
        animalId: 'cat-approval-a',
        animalIds: ['cat-approval-a', 'cat-approval-b'],
        animalName: 'Approval A',
        animalNames: ['Approval A', 'Approval B'],
        status: 'in_review',
      }),
    )

    await callable('updateApplicationReview')({
      id: 'app-joint-approval',
      status: 'approved',
    })

    const [appDoc, firstAnimalDoc, secondAnimalDoc] = await Promise.all([
      adminDb.collection('applications').doc('app-joint-approval').get(),
      adminDb.collection('animals').doc('cat-approval-a').get(),
      adminDb.collection('animals').doc('cat-approval-b').get(),
    ])

    expect(appDoc.data()?.status).toBe('approved')
    expect(firstAnimalDoc.data()?.status).toBe('adopted')
    expect(secondAnimalDoc.data()?.status).toBe('adopted')
    expect(firstAnimalDoc.data()?.adoptedApplicationId).toBe('app-joint-approval')
    expect(secondAnimalDoc.data()?.adoptedApplicationId).toBe('app-joint-approval')
  })

  it('approval generates contractArchiveFileId and contractGenerationStatus=stored', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-contract').set(availableAnimalDoc())
    await adminDb.collection('applications').doc('app-contract').set(
      encryptedApplicationDoc({ animalId: 'cat-contract', animalName: 'Test Cat', status: 'in_review' }),
    )

    await callable('updateApplicationReview')({
      id: 'app-contract',
      status: 'approved',
    })

    const appDoc = await adminDb.collection('applications').doc('app-contract').get()
    const data = appDoc.data() ?? {}
    expect(typeof data.contractArchiveFileId).toBe('string')
    expect(data.contractArchiveFileId).toBeTruthy()
    expect(data.contractGenerationStatus).toBe('stored')
  })

  it('approval creates an archiveFiles document of type contract', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-archivefile').set(availableAnimalDoc())
    await adminDb.collection('applications').doc('app-archivefile').set(
      encryptedApplicationDoc({ animalId: 'cat-archivefile', animalName: 'Test Cat', status: 'in_review' }),
    )

    await callable('updateApplicationReview')({
      id: 'app-archivefile',
      status: 'approved',
    })

    const appDoc = await adminDb.collection('applications').doc('app-archivefile').get()
    const archiveFileId = appDoc.data()?.contractArchiveFileId as string

    const archiveDoc = await adminDb.collection('archiveFiles').doc(archiveFileId).get()
    expect(archiveDoc.exists).toBe(true)
    expect(archiveDoc.data()?.type).toBe('contract')
    expect(archiveDoc.data()?.applicationId).toBe('app-archivefile')
    expect((archiveDoc.data()?.storagePath as string).startsWith('private-pdfs/contracts/')).toBe(true)
  })

  it('approval uploads a PDF to private-pdfs/contracts in Storage', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-storage').set(availableAnimalDoc())
    await adminDb.collection('applications').doc('app-storage').set(
      encryptedApplicationDoc({ animalId: 'cat-storage', animalName: 'Test Cat', status: 'in_review' }),
    )

    await callable('updateApplicationReview')({
      id: 'app-storage',
      status: 'approved',
    })

    const appDoc = await adminDb.collection('applications').doc('app-storage').get()
    const archiveFileId = appDoc.data()?.contractArchiveFileId as string
    const archiveDoc = await adminDb.collection('archiveFiles').doc(archiveFileId).get()
    const storagePath = archiveDoc.data()?.storagePath as string

    const [exists] = await adminStorage.bucket(STORAGE_BUCKET).file(storagePath).exists()
    expect(exists).toBe(true)
  })

  it('moving an approved application to in_review deletes the contract archive and clears references', async () => {
    await signInAsAdmin()

    // Seed archiveFiles doc pointing to a real storage file
    const archiveId = 'archive-to-delete'
    const storagePath = 'private-pdfs/contracts/2026/reversal-test.pdf'

    await adminDb.collection('archiveFiles').doc(archiveId).set({
      type: 'contract',
      storagePath,
      fileName: 'reversal-test.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
      year: 2026,
      applicationId: 'app-reversal',
      status: 'stored',
    })

    // Upload a dummy file so deleteStorageFileIfExists has something to delete
    await adminStorage.bucket(STORAGE_BUCKET).file(storagePath).save(Buffer.from('dummy-pdf'))

    // Seed the approved application referencing the archive
    await adminDb.collection('applications').doc('app-reversal').set(
      encryptedApplicationDoc({
        animalId: 'cat-reversal',
        animalName: 'Test Cat',
        status: 'approved',
        contractArchiveFileId: archiveId,
        contractGenerationStatus: 'stored',
      }),
    )
    await adminDb.collection('animals').doc('cat-reversal').set(
      availableAnimalDoc({ status: 'adopted', adoptedApplicationId: 'app-reversal' }),
    )

    // Reverse the approval
    await callable('updateApplicationReview')({
      id: 'app-reversal',
      status: 'in_review',
    })

    const [appDoc, archiveDoc] = await Promise.all([
      adminDb.collection('applications').doc('app-reversal').get(),
      adminDb.collection('archiveFiles').doc(archiveId).get(),
    ])

    expect(appDoc.data()?.status).toBe('in_review')
    expect(appDoc.data()?.contractArchiveFileId).toBeUndefined()
    expect(archiveDoc.exists).toBe(false)

    const [fileExists] = await adminStorage.bucket(STORAGE_BUCKET).file(storagePath).exists()
    expect(fileExists).toBe(false)
  })

  it('adopted animal cannot be reversed via updateAnimalStatus', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-adopted-guard').set(
      availableAnimalDoc({ status: 'adopted', adoptedApplicationId: 'some-app' }),
    )

    await expect(
      callable('updateAnimalStatus')({ animalId: 'cat-adopted-guard', status: 'available' }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('deleteAnimal blocks animals with linked applications', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-delete-blocked').set(availableAnimalDoc())
    await adminDb.collection('applications').doc('app-delete-blocker').set(
      encryptedApplicationDoc({
        animalId: 'cat-delete-blocked',
        animalName: 'Test Cat',
        status: 'pending',
      }),
    )

    await expect(
      callable('deleteAnimal')({
        animalId: 'cat-delete-blocked',
        reason: 'Cadastro duplicado criado em teste interno',
      }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })

    const animalDoc = await adminDb.collection('animals').doc('cat-delete-blocked').get()
    expect(animalDoc.exists).toBe(true)
  })

  it('deleteAnimal is restricted to admins', async () => {
    await signInAsReviewer()
    await adminDb.collection('animals').doc('cat-delete-reviewer').set(availableAnimalDoc())

    await expect(
      callable('deleteAnimal')({
        animalId: 'cat-delete-reviewer',
        reason: 'Cadastro duplicado criado em teste interno',
      }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' })
  })

  it('removes adopted animals from similarity caches and deletes their own cache doc', async () => {
    await signInAsAdmin()

    const targetRef = adminDb.collection('animals').doc('dog-target')
    const candidateRef = adminDb.collection('animals').doc('dog-candidate')
    await targetRef.set(
      availableAnimalDoc({
        name: 'Target Dog',
        species: 'dog',
        sex: 'male',
        size: 'medium',
        status: 'under_review',
      }),
    )
    await candidateRef.set(
      availableAnimalDoc({ name: 'Candidate Dog', species: 'dog', sex: 'male', size: 'medium' }),
    )
    await callable('updateAnimalStatus')({ animalId: 'dog-target', status: 'available' })

    await waitFor(async () => {
      const cacheDoc = await adminDb.collection('animalSimilarityCache').doc('dog-target').get()
      const items = (cacheDoc.data()?.items as Array<Record<string, unknown>> | undefined) ?? []
      expect(items.some((item) => item.id === 'dog-candidate')).toBe(true)
    })

    await adminDb.collection('animalSimilarityCache').doc('dog-candidate').set({
      items: [{ id: 'dog-target', status: 'available' }],
      itemIds: ['dog-target'],
      updatedAt: Timestamp.now(),
    })

    await callable('updateAnimalStatus')({ animalId: 'dog-candidate', status: 'adopted' })

    await waitFor(async () => {
      const [targetCache, candidateCache] = await Promise.all([
        adminDb.collection('animalSimilarityCache').doc('dog-target').get(),
        adminDb.collection('animalSimilarityCache').doc('dog-candidate').get(),
      ])
      const items = (targetCache.data()?.items as Array<Record<string, unknown>> | undefined) ?? []
      const itemIds = (targetCache.data()?.itemIds as string[] | undefined) ?? []

      expect(items.some((item) => item.id === 'dog-candidate')).toBe(false)
      expect(itemIds).not.toContain('dog-candidate')
      expect(candidateCache.exists).toBe(false)
    })
  })
})

// ── Suite 3: Privacy / LGPD callables ─────────────────────────────────────────

describe('Privacy/LGPD callables', () => {
  // Reason must contain no digits or @ signs (validated by validatePrivacyReason)
  const REASON = 'Solicitação de exclusão conforme LGPD, requerida pelo titular dos dados'

  beforeEach(async () => {
    await clearFirestoreEmulator()
    await clearStorageEmulator()
    await signOutClient()
  })

  // ── previewPrivacyRequest access control ────────────────────────────────────

  it('unauthenticated caller is denied for previewPrivacyRequest', async () => {
    await expect(
      callable('previewPrivacyRequest')({ type: 'cpf', value: VALID_CPF_1 }),
    ).rejects.toMatchObject({ code: 'functions/unauthenticated' })
  })

  it('reviewer is denied for previewPrivacyRequest', async () => {
    await signInAsReviewer()

    await expect(
      callable('previewPrivacyRequest')({ type: 'cpf', value: VALID_CPF_1 }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' })
  })

  it('reviewer is denied for deletePrivacyApplicationData', async () => {
    await signInAsReviewer()
    await adminDb.collection('applications').doc('app-privacy').set(encryptedApplicationDoc())

    await expect(
      callable('deletePrivacyApplicationData')({ applicationId: 'app-privacy', reason: REASON }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' })
  })

  it('reviewer is denied for deletePrivacyArchiveFile', async () => {
    await signInAsReviewer()

    await expect(
      callable('deletePrivacyArchiveFile')({ archiveFileId: 'some-id', reason: REASON }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' })
  })

  // ── previewPrivacyRequest returns sanitized data ────────────────────────────

  it('admin can preview by CPF and receives sanitized application data', async () => {
    // Create the application via the callable so the production HMAC function
    // stores the privacyIndex — this guarantees hash alignment with the preview query.
    await signOutClient()
    const createResult = await callable('createApplication')(baseApplication())
    const { id: appId } = createResult.data as { id: string }

    await signInAsAdmin()

    const result = await callable('previewPrivacyRequest')({ type: 'cpf', value: VALID_CPF_1 })
    const { applications } = result.data as { applications: unknown[] }

    expect(Array.isArray(applications)).toBe(true)
    expect(applications.length).toBeGreaterThan(0)

    const app = applications[0] as Record<string, unknown>
    expect(typeof app.id).toBe('string')
    expect(app.id).toBe(appId)
    expect(app.status).toBe('pending')

    // Sanitized response must NOT expose raw PII fields
    expect(app.cpf).toBeUndefined()
    expect(app.phone).toBeUndefined()
    expect(app.birthDate).toBeUndefined()
    expect(app.address).toBeUndefined()
    expect(app.fullName).toBeUndefined()
    expect(app.email).toBeUndefined()
    expect(app.privacyIndex).toBeUndefined()
  })

  it('admin can preview by email hash and receives sanitized data', async () => {
    await signOutClient()
    await callable('createApplication')(baseApplication())

    await signInAsAdmin()

    const result = await callable('previewPrivacyRequest')({
      type: 'email',
      value: 'applicant@test.example',
    })
    const { applications } = result.data as { applications: unknown[] }

    expect(applications.length).toBeGreaterThan(0)
    const app = applications[0] as Record<string, unknown>
    expect(app.cpf).toBeUndefined()
    expect(app.privacyIndex).toBeUndefined()
    expect(app.status).toBeDefined()
  })

  // ── deletePrivacyApplicationData ────────────────────────────────────────────

  it('deletePrivacyApplicationData requires a non-empty reason', async () => {
    await signInAsAdmin()
    await adminDb.collection('applications').doc('app-del').set(encryptedApplicationDoc())

    await expect(
      callable('deletePrivacyApplicationData')({ applicationId: 'app-del', reason: '' }),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('admin deletes application data and audit record contains no raw PII', async () => {
    await signInAsAdmin()

    await adminDb.collection('applications').doc('app-lgpd').set(encryptedApplicationDoc())

    const result = await callable('deletePrivacyApplicationData')({
      applicationId: 'app-lgpd',
      reason: REASON,
    })
    expect((result.data as { success: boolean }).success).toBe(true)

    // Application document must be gone
    const doc = await adminDb.collection('applications').doc('app-lgpd').get()
    expect(doc.exists).toBe(false)

    // Audit record must exist but must not contain raw PII
    const auditSnap = await adminDb
      .collection('privacyRequestAudits')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
    expect(auditSnap.empty).toBe(false)

    const audit = auditSnap.docs[0].data()
    expect(audit.action).toBe('delete_application')
    expect(audit.result).toBe('deleted')
    // Must not log CPF, phone, email, or any plaintext PII
    expect(audit.cpf).toBeUndefined()
    expect(audit.phone).toBeUndefined()
    expect(audit.email).toBeUndefined()
    expect(audit.birthDate).toBeUndefined()
    expect(audit.address).toBeUndefined()
    expect(audit.fullName).toBeUndefined()
  })

  it('deletePrivacyApplicationData deletes an active application and recomputes animal queue state', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-lgpd-queue').set(
      availableAnimalDoc({ status: 'under_review', activeApplicationCount: 2 }),
    )
    await adminDb.collection('applications').doc('app-lgpd-delete-active').set(
      encryptedApplicationDoc({
        animalId: 'cat-lgpd-queue',
        animalName: 'Test Cat',
        status: 'pending',
        queuePosition: 2,
        waitlistEntry: true,
      }),
    )
    await adminDb.collection('applications').doc('app-lgpd-remaining').set(
      encryptedApplicationDoc({
        animalId: 'cat-lgpd-queue',
        animalName: 'Test Cat',
        status: 'pending',
        queuePosition: 5,
        waitlistEntry: true,
      }),
    )

    const result = await callable('deletePrivacyApplicationData')({
      applicationId: 'app-lgpd-delete-active',
      reason: REASON,
    })
    expect((result.data as { success: boolean; animalRecomputed?: boolean }).success).toBe(true)
    expect((result.data as { animalRecomputed?: boolean }).animalRecomputed).toBe(true)

    const [deletedDoc, remainingDoc, animalDoc] = await Promise.all([
      adminDb.collection('applications').doc('app-lgpd-delete-active').get(),
      adminDb.collection('applications').doc('app-lgpd-remaining').get(),
      adminDb.collection('animals').doc('cat-lgpd-queue').get(),
    ])

    expect(deletedDoc.exists).toBe(false)
    expect(remainingDoc.data()?.queuePosition).toBe(1)
    expect(remainingDoc.data()?.waitlistEntry).toBe(false)
    expect(animalDoc.data()?.activeApplicationCount).toBe(1)
    expect(animalDoc.data()?.status).toBe('available')
  })

  it('deletePrivacyApplicationData blocks approved applications pending adoption-record decision', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-lgpd-approved').set(
      availableAnimalDoc({ status: 'adopted', adoptedApplicationId: 'app-lgpd-approved' }),
    )
    await adminDb.collection('applications').doc('app-lgpd-approved').set(
      encryptedApplicationDoc({
        animalId: 'cat-lgpd-approved',
        animalName: 'Test Cat',
        status: 'approved',
        contractArchiveFileId: 'archive-contract-lgpd',
      }),
    )

    await expect(
      callable('deletePrivacyApplicationData')({
        applicationId: 'app-lgpd-approved',
        reason: REASON,
      }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })

    const [appDoc, animalDoc] = await Promise.all([
      adminDb.collection('applications').doc('app-lgpd-approved').get(),
      adminDb.collection('animals').doc('cat-lgpd-approved').get(),
    ])
    expect(appDoc.exists).toBe(true)
    expect(animalDoc.data()?.status).toBe('adopted')
    expect(animalDoc.data()?.adoptedApplicationId).toBe('app-lgpd-approved')
  })

  // ── deletePrivacyArchiveFile ────────────────────────────────────────────────

  it('deletePrivacyArchiveFile deletes archiveFiles doc, Storage PDF, and clears application references', async () => {
    await signInAsAdmin()

    const archiveId = 'archive-privacy-del'
    const storagePath = 'private-pdfs/contracts/2026/privacy-del-test.pdf'

    // Seed archiveFiles doc
    await adminDb.collection('archiveFiles').doc(archiveId).set({
      type: 'contract',
      storagePath,
      fileName: 'privacy-del-test.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
      year: 2026,
      applicationId: 'app-with-archive',
      status: 'stored',
    })

    // Seed application referencing the archive
    await adminDb.collection('applications').doc('app-with-archive').set(
      encryptedApplicationDoc({
        contractArchiveFileId: archiveId,
        contractGenerationStatus: 'stored',
        status: 'approved',
      }),
    )

    // Upload dummy PDF to Storage
    await adminStorage.bucket(STORAGE_BUCKET).file(storagePath).save(Buffer.from('dummy-pdf'))

    const result = await callable('deletePrivacyArchiveFile')({ archiveFileId: archiveId, reason: REASON })
    expect((result.data as { success: boolean }).success).toBe(true)

    // archiveFiles doc must be gone
    const archiveDoc = await adminDb.collection('archiveFiles').doc(archiveId).get()
    expect(archiveDoc.exists).toBe(false)

    // Storage file must be gone
    const [fileExists] = await adminStorage.bucket(STORAGE_BUCKET).file(storagePath).exists()
    expect(fileExists).toBe(false)

    // Application reference must be cleared
    const appDoc = await adminDb.collection('applications').doc('app-with-archive').get()
    expect(appDoc.data()?.contractArchiveFileId).toBeUndefined()
  })

  it('privacyRequestAudits contain no raw PII fields', async () => {
    await signInAsAdmin()

    const archiveId = 'archive-audit-check'
    const storagePath = 'private-pdfs/rejections/2026/audit-check.pdf'

    await adminDb.collection('archiveFiles').doc(archiveId).set({
      type: 'rejection',
      storagePath,
      fileName: 'audit-check.pdf',
      contentType: 'application/pdf',
      sizeBytes: 50,
      year: 2026,
      applicationId: 'some-app',
      status: 'stored',
    })
    await adminStorage.bucket(STORAGE_BUCKET).file(storagePath).save(Buffer.from('dummy'))

    await callable('deletePrivacyArchiveFile')({ archiveFileId: archiveId, reason: REASON })

    const auditSnap = await adminDb
      .collection('privacyRequestAudits')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
    expect(auditSnap.empty).toBe(false)

    const audit = auditSnap.docs[0].data()
    const prohibited = ['cpf', 'phone', 'email', 'birthDate', 'address', 'fullName', 'name']
    for (const field of prohibited) {
      expect(audit[field]).toBeUndefined()
    }
    // Audit has safe metadata only
    expect(audit.action).toBe('delete_archive_file')
    expect(typeof audit.actorUid).toBe('string')
    expect(audit.result).toBeDefined()
    expect(typeof audit.createdAt).toBe('object') // Firestore Timestamp
  })
})

// ── Suite 4: Staff final animal assignment ────────────────────────────────────

describe('staff final animal assignment via updateApplicationReview', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator()
    await clearStorageEmulator()
    await signOutClient()
  })

  it('staff assigns second cat to a specific-animal application', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-assign-a').set(
      availableAnimalDoc({ name: 'Assign A', activeApplicationCount: 1 }),
    )
    await adminDb.collection('animals').doc('cat-assign-b').set(
      availableAnimalDoc({ name: 'Assign B', activeApplicationCount: 0 }),
    )
    await adminDb.collection('applications').doc('app-assign').set(
      encryptedApplicationDoc({
        animalId: 'cat-assign-a',
        animalIds: ['cat-assign-a'],
        animalName: 'Assign A',
        animalNames: ['Assign A'],
        queuePosition: 1,
        status: 'in_review',
      }),
    )

    await callable('updateApplicationReview')({
      id: 'app-assign',
      status: 'in_review',
      animalIds: ['cat-assign-a', 'cat-assign-b'],
    })

    const [appDoc, catA, catB] = await Promise.all([
      adminDb.collection('applications').doc('app-assign').get(),
      adminDb.collection('animals').doc('cat-assign-a').get(),
      adminDb.collection('animals').doc('cat-assign-b').get(),
    ])

    expect(appDoc.data()?.animalId).toBe('cat-assign-a')
    expect(appDoc.data()?.animalIds).toEqual(['cat-assign-a', 'cat-assign-b'])
    expect(appDoc.data()?.animalNames).toEqual(['Assign A', 'Assign B'])
    // cat-assign-a was already linked — count unchanged
    expect(catA.data()?.activeApplicationCount).toBe(1)
    // cat-assign-b was newly added — count incremented
    expect(catB.data()?.activeApplicationCount).toBe(1)
  })

  it('old linked animal has its activeApplicationCount decremented when replaced', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-old').set(
      availableAnimalDoc({ name: 'Old Cat', activeApplicationCount: 2 }),
    )
    await adminDb.collection('animals').doc('cat-new').set(
      availableAnimalDoc({ name: 'New Cat', activeApplicationCount: 0 }),
    )
    await adminDb.collection('applications').doc('app-replace').set(
      encryptedApplicationDoc({
        animalId: 'cat-old',
        animalIds: ['cat-old'],
        animalName: 'Old Cat',
        animalNames: ['Old Cat'],
        queuePosition: 1,
        status: 'in_review',
      }),
    )

    await callable('updateApplicationReview')({
      id: 'app-replace',
      status: 'in_review',
      animalIds: ['cat-new'],
    })

    const [catOld, catNew] = await Promise.all([
      adminDb.collection('animals').doc('cat-old').get(),
      adminDb.collection('animals').doc('cat-new').get(),
    ])

    // old animal decremented (was 2, should be 1)
    expect(catOld.data()?.activeApplicationCount).toBe(1)
    // new animal incremented (was 0, should be 1)
    expect(catNew.data()?.activeApplicationCount).toBe(1)
  })

  it('duplicate animalIds are rejected', async () => {
    await signInAsAdmin()

    await adminDb.collection('applications').doc('app-dup').set(encryptedApplicationDoc({ status: 'pending' }))

    await expect(
      callable('updateApplicationReview')({
        id: 'app-dup',
        status: 'pending',
        animalIds: ['cat-x', 'cat-x'],
      }),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('more than 2 animals are rejected', async () => {
    await signInAsAdmin()

    await adminDb.collection('applications').doc('app-too-many').set(encryptedApplicationDoc({ status: 'pending' }))

    await expect(
      callable('updateApplicationReview')({
        id: 'app-too-many',
        status: 'pending',
        animalIds: ['cat-1', 'cat-2', 'cat-3'],
      }),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('empty animalIds array is rejected', async () => {
    await signInAsAdmin()

    await adminDb.collection('applications').doc('app-empty').set(encryptedApplicationDoc({ status: 'pending' }))

    await expect(
      callable('updateApplicationReview')({
        id: 'app-empty',
        status: 'pending',
        animalIds: [],
      }),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('cat + dog joint assignment is rejected', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-joint').set(availableAnimalDoc({ name: 'Cat' }))
    await adminDb.collection('animals').doc('dog-joint').set(
      availableAnimalDoc({ name: 'Dog', species: 'dog', size: 'medium' }),
    )
    await adminDb.collection('applications').doc('app-cat-dog').set(
      encryptedApplicationDoc({ status: 'in_review' }),
    )

    await expect(
      callable('updateApplicationReview')({
        id: 'app-cat-dog',
        status: 'in_review',
        animalIds: ['cat-joint', 'dog-joint'],
      }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('non-existent animal in animalIds is rejected', async () => {
    await signInAsAdmin()

    await adminDb.collection('applications').doc('app-ghost').set(encryptedApplicationDoc({ status: 'pending' }))

    await expect(
      callable('updateApplicationReview')({
        id: 'app-ghost',
        status: 'pending',
        animalIds: ['ghost-animal-id-does-not-exist'],
      }),
    ).rejects.toMatchObject({ code: 'functions/not-found' })
  })

  it('animal editing is blocked for approved applications', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-approved-lock').set(
      availableAnimalDoc({ status: 'adopted', adoptedApplicationId: 'app-approved-lock' }),
    )
    await adminDb.collection('animals').doc('cat-new-attempt').set(availableAnimalDoc({ name: 'New Cat' }))
    await adminDb.collection('applications').doc('app-approved-lock').set(
      encryptedApplicationDoc({
        animalId: 'cat-approved-lock',
        animalIds: ['cat-approved-lock'],
        status: 'approved',
      }),
    )

    await expect(
      callable('updateApplicationReview')({
        id: 'app-approved-lock',
        status: 'approved',
        animalIds: ['cat-new-attempt'],
      }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('animal editing is blocked for rejected applications', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-rejected-lock').set(availableAnimalDoc())
    await adminDb.collection('animals').doc('cat-new-attempt-2').set(availableAnimalDoc({ name: 'New Cat' }))
    await adminDb.collection('applications').doc('app-rejected-lock').set(
      encryptedApplicationDoc({
        animalId: 'cat-rejected-lock',
        animalIds: ['cat-rejected-lock'],
        status: 'rejected',
        rejectionReason: 'inadequate_housing',
        rejectionDetails: 'Moradia inadequada para gatos conforme visita realizada pela equipe de voluntários durante a visita domiciliar obrigatória.',
      }),
    )

    await expect(
      callable('updateApplicationReview')({
        id: 'app-rejected-lock',
        status: 'rejected',
        animalIds: ['cat-new-attempt-2'],
        rejectionReason: 'inadequate_housing',
        rejectionDetails: 'Moradia inadequada para gatos conforme visita realizada pela equipe de voluntários durante a visita domiciliar obrigatória.',
      }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('legacy application with only animalId (no animalIds field) accepts staff animalIds assignment', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-legacy').set(
      availableAnimalDoc({ name: 'Legacy Cat', activeApplicationCount: 1 }),
    )
    await adminDb.collection('animals').doc('cat-legacy-2').set(
      availableAnimalDoc({ name: 'Legacy Cat 2', activeApplicationCount: 0 }),
    )
    // Legacy doc: has animalId but no animalIds
    await adminDb.collection('applications').doc('app-legacy').set(
      encryptedApplicationDoc({
        animalId: 'cat-legacy',
        animalName: 'Legacy Cat',
        queuePosition: 1,
        status: 'in_review',
        // no animalIds field
      }),
    )

    await callable('updateApplicationReview')({
      id: 'app-legacy',
      status: 'in_review',
      animalIds: ['cat-legacy', 'cat-legacy-2'],
    })

    const appDoc = await adminDb.collection('applications').doc('app-legacy').get()
    expect(appDoc.data()?.animalId).toBe('cat-legacy')
    expect(appDoc.data()?.animalIds).toEqual(['cat-legacy', 'cat-legacy-2'])
    expect(appDoc.data()?.animalNames).toContain('Legacy Cat')
    expect(appDoc.data()?.animalNames).toContain('Legacy Cat 2')
  })

  it('approval of application with two staff-assigned cats marks both as adopted', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-dual-a').set(availableAnimalDoc({ name: 'Dual A' }))
    await adminDb.collection('animals').doc('cat-dual-b').set(availableAnimalDoc({ name: 'Dual B' }))
    // Seed the application already with both cats (as if staff already assigned them)
    await adminDb.collection('applications').doc('app-dual-approval').set(
      encryptedApplicationDoc({
        animalId: 'cat-dual-a',
        animalIds: ['cat-dual-a', 'cat-dual-b'],
        animalName: 'Dual A',
        animalNames: ['Dual A', 'Dual B'],
        status: 'in_review',
      }),
    )

    await callable('updateApplicationReview')({
      id: 'app-dual-approval',
      status: 'approved',
    })

    const [appDoc, catA, catB] = await Promise.all([
      adminDb.collection('applications').doc('app-dual-approval').get(),
      adminDb.collection('animals').doc('cat-dual-a').get(),
      adminDb.collection('animals').doc('cat-dual-b').get(),
    ])

    expect(appDoc.data()?.status).toBe('approved')
    expect(catA.data()?.status).toBe('adopted')
    expect(catB.data()?.status).toBe('adopted')
    expect(catA.data()?.adoptedApplicationId).toBe('app-dual-approval')
    expect(catB.data()?.adoptedApplicationId).toBe('app-dual-approval')
  })

  it('cat adoption contract does not contain "Porte:" label', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-porte-check').set(
      availableAnimalDoc({ name: 'Porte Check Cat', size: 'small' }),
    )
    await adminDb.collection('applications').doc('app-porte-check').set(
      encryptedApplicationDoc({
        animalId: 'cat-porte-check',
        animalIds: ['cat-porte-check'],
        animalName: 'Porte Check Cat',
        animalNames: ['Porte Check Cat'],
        status: 'in_review',
      }),
    )

    await callable('updateApplicationReview')({
      id: 'app-porte-check',
      status: 'approved',
    })

    const appDoc = await adminDb.collection('applications').doc('app-porte-check').get()
    const archiveFileId = appDoc.data()?.contractArchiveFileId as string
    expect(typeof archiveFileId).toBe('string')

    const archiveDoc = await adminDb.collection('archiveFiles').doc(archiveFileId).get()
    const storagePath = archiveDoc.data()?.storagePath as string

    const [pdfBuffer] = await adminStorage.bucket(STORAGE_BUCKET).file(storagePath).download()
    // pdf-lib stores uncompressed text streams; PDF text operators use parentheses: (Porte: )
    const pdfContent = pdfBuffer.toString('latin1')
    expect(pdfContent).not.toContain('Porte:')
    expect(pdfContent).not.toContain('Porte ')
  })
})

describe('jointAdoption consent enforcement for staff cat assignment', () => {
  it('rejects 2 cats when jointAdoption is false', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-joint-a').set(availableAnimalDoc({ name: 'Cat A' }))
    await adminDb.collection('animals').doc('cat-joint-b').set(availableAnimalDoc({ name: 'Cat B' }))
    await adminDb.collection('applications').doc('app-no-joint').set(
      encryptedApplicationDoc({
        species: 'cat',
        jointAdoption: false,
        status: 'in_review',
      }),
    )

    await expect(
      callable('updateApplicationReview')({
        id: 'app-no-joint',
        status: 'in_review',
        animalIds: ['cat-joint-a', 'cat-joint-b'],
      }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('rejects 2 cats when jointAdoption field is missing (legacy)', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-legacy-joint-a').set(availableAnimalDoc({ name: 'Legacy A' }))
    await adminDb.collection('animals').doc('cat-legacy-joint-b').set(availableAnimalDoc({ name: 'Legacy B' }))
    await adminDb.collection('applications').doc('app-missing-joint').set(
      encryptedApplicationDoc({
        species: 'cat',
        status: 'pending',
        // jointAdoption intentionally absent
      }),
    )

    await expect(
      callable('updateApplicationReview')({
        id: 'app-missing-joint',
        status: 'pending',
        animalIds: ['cat-legacy-joint-a', 'cat-legacy-joint-b'],
      }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' })
  })

  it('allows 1 cat when jointAdoption is false', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-single-ok').set(availableAnimalDoc({ name: 'Solo Cat' }))
    await adminDb.collection('applications').doc('app-single-cat').set(
      encryptedApplicationDoc({
        species: 'cat',
        jointAdoption: false,
        status: 'pending',
      }),
    )

    await expect(
      callable('updateApplicationReview')({
        id: 'app-single-cat',
        status: 'pending',
        animalIds: ['cat-single-ok'],
      }),
    ).resolves.toMatchObject({ success: true })

    const snap = await adminDb.collection('applications').doc('app-single-cat').get()
    expect(snap.data()?.animalId).toBe('cat-single-ok')
    expect(snap.data()?.animalIds).toEqual(['cat-single-ok'])
  })

  it('allows 2 cats when jointAdoption is true', async () => {
    await signInAsAdmin()

    await adminDb.collection('animals').doc('cat-pair-a').set(availableAnimalDoc({ name: 'Pair A' }))
    await adminDb.collection('animals').doc('cat-pair-b').set(availableAnimalDoc({ name: 'Pair B' }))
    await adminDb.collection('applications').doc('app-joint-ok').set(
      encryptedApplicationDoc({
        species: 'cat',
        jointAdoption: true,
        status: 'pending',
      }),
    )

    await expect(
      callable('updateApplicationReview')({
        id: 'app-joint-ok',
        status: 'pending',
        animalIds: ['cat-pair-a', 'cat-pair-b'],
      }),
    ).resolves.toMatchObject({ success: true })

    const snap = await adminDb.collection('applications').doc('app-joint-ok').get()
    expect(snap.data()?.animalIds).toEqual(['cat-pair-a', 'cat-pair-b'])
  })
})
