import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const PROJECT_ID = 'demo-upeva-test'
const BUCKET_URL = `gs://${PROJECT_ID}.appspot.com`

let testEnv: RulesTestEnvironment

function bytes(size: number) {
  return new Uint8Array(size)
}

function putAnimalPhoto(
  context: RulesTestContext,
  path: string,
  contentType: string,
  size = 16,
) {
  const task = context
    .storage(BUCKET_URL)
    .ref(path)
    .put(bytes(size), { contentType })

  return new Promise((resolve, reject) => {
    task.then(resolve, reject)
  })
}

describe('Storage security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      storage: {
        rules: readFileSync(resolve('storage.rules'), 'utf8'),
      },
    })
  })

  beforeEach(async () => {
    await testEnv.clearStorage()
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  it('denies unauthenticated uploads', async () => {
    const context = testEnv.unauthenticatedContext()

    await assertFails(
      putAnimalPhoto(context, 'animals/public/cat.jpg', 'image/jpeg'),
    )
  })

  it('denies uploads from authenticated non-staff users', async () => {
    const context = testEnv.authenticatedContext('alice')

    await assertFails(putAnimalPhoto(context, 'animals/alice/cat.png', 'image/png'))
  })

  it('allows staff jpeg, png, and webp uploads', async () => {
    const reviewer = testEnv.authenticatedContext('reviewer', { role: 'reviewer' })
    const admin = testEnv.authenticatedContext('admin', { role: 'admin' })

    await assertSucceeds(putAnimalPhoto(reviewer, 'animals/reviewer/cat.jpg', 'image/jpeg'))
    await assertSucceeds(putAnimalPhoto(admin, 'animals/admin/cat.png', 'image/png'))
    await assertSucceeds(putAnimalPhoto(reviewer, 'animals/reviewer/cat.webp', 'image/webp'))
  })

  it('denies staff svg uploads', async () => {
    const context = testEnv.authenticatedContext('reviewer', { role: 'reviewer' })

    await assertFails(putAnimalPhoto(context, 'animals/reviewer/vector.svg', 'image/svg+xml'))
  })

  it('denies files at or above the configured 5 MB limit', async () => {
    const context = testEnv.authenticatedContext('admin', { role: 'admin' })

    await assertFails(
      putAnimalPhoto(context, 'animals/admin/too-large.jpg', 'image/jpeg', 5 * 1024 * 1024),
    )
  })
})
