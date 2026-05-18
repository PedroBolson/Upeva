/**
 * scripts/lib/admin.js
 * Shared Firebase Admin initialization for all reset scripts.
 * Handles credential resolution, project ID discovery, and storage bucket naming.
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { red, dim } from './colors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(__dirname, '../..')

// ── Credential resolution ─────────────────────────────────────────────────────

export function resolveCredentials() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv) {
    const resolved = resolve(fromEnv)
    if (!existsSync(resolved)) {
      console.error(red(`\n✗ GOOGLE_APPLICATION_CREDENTIALS points to a missing file:`))
      console.error(red(`  ${resolved}\n`))
      process.exit(1)
    }
    return { path: resolved, source: 'GOOGLE_APPLICATION_CREDENTIALS env var' }
  }

  const localKey = resolve(ROOT, 'serviceAccountKey.json')
  if (existsSync(localKey)) {
    return { path: localKey, source: './serviceAccountKey.json' }
  }

  console.error(red('\n✗ No Firebase credentials found.'))
  console.error(red('  Provide one of:'))
  console.error(red('    1. GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json'))
  console.error(red('    2. serviceAccountKey.json in the project root'))
  console.error(dim('\n  Get a key: Firebase Console → Project Settings → Service Accounts → Generate new private key\n'))
  process.exit(1)
}

// ── Project ID from .firebaserc ───────────────────────────────────────────────

export function readProjectId() {
  const rcPath = resolve(ROOT, '.firebaserc')
  if (!existsSync(rcPath)) return null
  try {
    const rc = JSON.parse(readFileSync(rcPath, 'utf8'))
    return rc?.projects?.default ?? null
  } catch {
    return null
  }
}

// ── Storage bucket name ───────────────────────────────────────────────────────
// Resolution order:
//   1. FIREBASE_STORAGE_BUCKET env var
//   2. VITE_FIREBASE_STORAGE_BUCKET env var
//   3. VITE_FIREBASE_STORAGE_BUCKET from .env file
//   4. Derived as {projectId}.firebasestorage.app

export function resolveStorageBucket(projectId) {
  if (process.env.FIREBASE_STORAGE_BUCKET) return process.env.FIREBASE_STORAGE_BUCKET
  if (process.env.VITE_FIREBASE_STORAGE_BUCKET) return process.env.VITE_FIREBASE_STORAGE_BUCKET

  const envPath = resolve(ROOT, '.env')
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(/VITE_FIREBASE_STORAGE_BUCKET=(.+)/)
    if (match?.[1]?.trim()) return match[1].trim()
  }

  return `${projectId}.firebasestorage.app`
}

// ── Firebase Admin initialization ─────────────────────────────────────────────
// Returns { app, db, bucket, projectId, bucketName, creds }
// Both db and bucket are always initialized — callers can ignore bucket if not needed.

export function initAdmin() {
  const creds = resolveCredentials()
  const projectId = readProjectId()

  if (!projectId) {
    console.error(red('\n✗ Could not read project ID from .firebaserc\n'))
    process.exit(1)
  }

  if (projectId.startsWith('demo-')) {
    console.error(red(`\n✗ Project "${projectId}" looks like an emulator project. This script targets production only. Aborting.\n`))
    process.exit(1)
  }

  let serviceAccount
  try {
    serviceAccount = JSON.parse(readFileSync(creds.path, 'utf8'))
  } catch (err) {
    console.error(red(`\n✗ Failed to read service account key: ${err.message}\n`))
    process.exit(1)
  }

  const bucketName = resolveStorageBucket(projectId)

  let app
  try {
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId,
      storageBucket: bucketName,
    })
  } catch (err) {
    console.error(red(`\n✗ Failed to initialize Firebase Admin: ${err.message}\n`))
    process.exit(1)
  }

  const db = getFirestore(app)
  const bucket = getStorage(app).bucket()

  return { app, db, bucket, projectId, bucketName, creds }
}
