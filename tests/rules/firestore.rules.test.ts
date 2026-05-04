import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PROJECT_ID = 'demo-upeva-test'

let testEnv: RulesTestEnvironment

const userProfile = (uid: string, role: 'admin' | 'reviewer' = 'reviewer') => ({
  uid,
  email: `${uid}@example.test`,
  displayName: uid,
  role,
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'system',
})

const publicAnimal = (status: 'available' | 'under_review' | 'adopted' | 'archived') => ({
  name: `Animal ${status}`,
  species: 'cat',
  sex: 'female',
  description: 'Public profile',
  status,
  photos: [],
  coverPhotoIndex: 0,
  vaccines: [],
  neutered: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

async function seedFirestore() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await Promise.all([
      db.doc('users/alice').set(userProfile('alice', 'reviewer')),
      db.doc('users/bob').set(userProfile('bob', 'reviewer')),
      db.doc('users/admin').set(userProfile('admin', 'admin')),
      db.doc('users/reviewer').set(userProfile('reviewer', 'reviewer')),

      db.doc('animals/available-safe').set(publicAnimal('available')),
      db.doc('animals/under-review-safe').set(publicAnimal('under_review')),
      db.doc('animals/adopted').set(publicAnimal('adopted')),
      db.doc('animals/archived').set(publicAnimal('archived')),
      db.doc('animals/available-traceability').set({
        ...publicAnimal('available'),
        updatedBy: 'admin',
      }),
      db.doc('animals/available-adoption-internal').set({
        ...publicAnimal('available'),
        adoptedApplicationId: 'application-1',
      }),
      db.doc('animals/under-review-archive-internal').set({
        ...publicAnimal('under_review'),
        archiveReason: 'other',
      }),

      db.doc('applications/application-1').set({
        species: 'cat',
        fullName: 'Candidate',
        email: 'candidate@example.test',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      db.doc('metadata/counts').set({ animals: { total: 1 }, applications: { total: 1 } }),
      db.doc('metadata/featuredAnimals').set({ animalIds: [], items: [] }),
      db.doc('rejectionFlags/flag-1').set({
        cpfHash: 'hash-only',
        emailHash: 'hash-only',
        reason: 'other',
      }),
    ])
  })
}

describe('Firestore security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(resolve('firestore.rules'), 'utf8'),
      },
    })
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await seedFirestore()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  describe('users', () => {
    it('denies anonymous reads from users', async () => {
      const db = testEnv.unauthenticatedContext().firestore()

      await assertFails(db.doc('users/alice').get())
      await assertFails(db.collection('users').get())
    })

    it('allows an authenticated user to read only their own profile', async () => {
      const db = testEnv.authenticatedContext('alice', { role: 'reviewer' }).firestore()

      await assertSucceeds(db.doc('users/alice').get())
      await assertFails(db.doc('users/bob').get())
      await assertFails(db.collection('users').get())
    })

    it('allows admins to read and list users', async () => {
      const db = testEnv.authenticatedContext('admin', { role: 'admin' }).firestore()

      const ownProfile = await assertSucceeds(db.doc('users/admin').get())
      const allUsers = await assertSucceeds(db.collection('users').get())

      expect(ownProfile.exists).toBe(true)
      expect(allUsers.docs.map((doc) => doc.id)).toContain('alice')
    })

    it('denies user listing to reviewers', async () => {
      const db = testEnv.authenticatedContext('reviewer', { role: 'reviewer' }).firestore()

      await assertSucceeds(db.doc('users/reviewer').get())
      await assertFails(db.collection('users').get())
    })
  })

  describe('animals', () => {
    it('allows anonymous reads for public-safe animals without internal fields', async () => {
      const db = testEnv.unauthenticatedContext().firestore()

      const available = await assertSucceeds(db.doc('animals/available-safe').get())
      const underReview = await assertSucceeds(db.doc('animals/under-review-safe').get())

      expect(available.data()?.status).toBe('available')
      expect(underReview.data()?.status).toBe('under_review')
    })

    it('denies anonymous reads for adopted and archived animals', async () => {
      const db = testEnv.unauthenticatedContext().firestore()

      await assertFails(db.doc('animals/adopted').get())
      await assertFails(db.doc('animals/archived').get())
    })

    it('denies anonymous reads when public-status animals include internal fields', async () => {
      const db = testEnv.unauthenticatedContext().firestore()

      await assertFails(db.doc('animals/available-traceability').get())
      await assertFails(db.doc('animals/available-adoption-internal').get())
      await assertFails(db.doc('animals/under-review-archive-internal').get())
    })

    it('preserves staff read and animal maintenance permissions', async () => {
      const reviewerDb = testEnv.authenticatedContext('reviewer', { role: 'reviewer' }).firestore()
      const adminDb = testEnv.authenticatedContext('admin', { role: 'admin' }).firestore()
      const userDb = testEnv.authenticatedContext('alice').firestore()

      await assertSucceeds(reviewerDb.doc('animals/adopted').get())
      await assertSucceeds(adminDb.doc('animals/archived').get())
      await assertSucceeds(reviewerDb.doc('animals/staff-created').set({
        name: 'Staff animal',
        species: 'dog',
        sex: 'male',
        description: 'Created by staff through client rules contract',
        status: 'available',
      }))
      await assertSucceeds(reviewerDb.doc('animals/available-safe').update({
        description: 'Updated public description',
      }))
      await assertFails(reviewerDb.doc('animals/available-safe').update({ status: 'under_review' }))
      await assertFails(reviewerDb.doc('animals/available-safe').update({ updatedBy: 'reviewer' }))
      await assertFails(userDb.doc('animals/not-staff-created').set({
        name: 'Blocked',
        species: 'cat',
        sex: 'female',
        description: 'Blocked',
        status: 'available',
      }))
    })
  })

  describe('applications and staff-only data', () => {
    it('denies direct client creates and updates to applications', async () => {
      const anonymousDb = testEnv.unauthenticatedContext().firestore()
      const staffDb = testEnv.authenticatedContext('reviewer', { role: 'reviewer' }).firestore()

      await assertFails(anonymousDb.doc('applications/from-client').set({ status: 'pending' }))
      await assertFails(staffDb.doc('applications/from-staff-client').set({ status: 'pending' }))
      await assertFails(staffDb.doc('applications/application-1').update({ status: 'approved' }))
    })

    it('preserves staff/admin read contracts for operational collections', async () => {
      const reviewerDb = testEnv.authenticatedContext('reviewer', { role: 'reviewer' }).firestore()
      const adminDb = testEnv.authenticatedContext('admin', { role: 'admin' }).firestore()
      const userDb = testEnv.authenticatedContext('alice').firestore()
      const anonymousDb = testEnv.unauthenticatedContext().firestore()

      await assertSucceeds(reviewerDb.doc('applications/application-1').get())
      await assertSucceeds(adminDb.collection('applications').get())
      await assertSucceeds(reviewerDb.doc('metadata/counts').get())
      await assertSucceeds(adminDb.doc('rejectionFlags/flag-1').get())
      await assertSucceeds(anonymousDb.doc('metadata/featuredAnimals').get())

      await assertFails(userDb.doc('applications/application-1').get())
      await assertFails(anonymousDb.doc('metadata/counts').get())
      await assertFails(userDb.doc('rejectionFlags/flag-1').get())
      await assertFails(userDb.doc('rateLimits/hash-only').get())
      await assertFails(adminDb.doc('rateLimits/hash-only').get())
    })
  })
})
