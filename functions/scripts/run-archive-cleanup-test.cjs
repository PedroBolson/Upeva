'use strict'
/**
 * run-archive-cleanup-test.cjs
 * Runs runArchiveAndCleanup() — the extracted archive business logic — directly
 * against the LOCAL Firebase emulators.  Must be preceded by seed:archive-test.
 *
 * Safety guards:
 *  - Refuses to run if ALLOW_REAL_PROJECT is set.
 *  - Hard-codes project ID to demo-upeva-test; refuses any other value in GCLOUD_PROJECT.
 *  - Requires FIRESTORE_EMULATOR_HOST to be reachable (or defaults to 127.0.0.1:8080).
 *  - Requires FIREBASE_STORAGE_EMULATOR_HOST to be reachable (or defaults to 127.0.0.1:9199).
 *  - Probes both emulators with HTTP before loading the functions module.
 *  - Loads PII_ENCRYPTION_KEY + HMAC_SECRET_KEY from functions/.secret.local if not in env.
 *  - Never writes to Firestore or Storage unless both emulator probes succeed.
 *
 * Usage:
 *   npm run run:archive-test
 *   (must be run AFTER: npm run seed:archive-test)
 *
 * Prerequisites:
 *   firebase emulators:start --only auth,firestore,functions,storage
 *   cp functions/.secret.local.example functions/.secret.local   # first time only
 */

const { readFileSync, existsSync } = require('fs')
const { resolve } = require('path')
const http = require('http')

const PROJECT_ID = 'demo-upeva-test'
const BUCKET = `${PROJECT_ID}.appspot.com`

// ── Safety: refuse to run against a real project ──────────────────────────────
if (process.env.ALLOW_REAL_PROJECT) {
  console.error('[run-archive] ERROR: ALLOW_REAL_PROJECT is set. Refusing to run.')
  process.exit(1)
}

if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT_ID) {
  console.error(`[run-archive] ERROR: GCLOUD_PROJECT="${process.env.GCLOUD_PROJECT}" — only "${PROJECT_ID}" is allowed.`)
  process.exit(1)
}

// ── Set emulator env vars BEFORE importing the functions module ───────────────
// These must be in place when initializeApp() runs during module load.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
  console.log('[run-archive] FIRESTORE_EMULATOR_HOST defaulted to 127.0.0.1:8080')
}
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199'
  console.log('[run-archive] FIREBASE_STORAGE_EMULATOR_HOST defaulted to 127.0.0.1:9199')
}

process.env.GCLOUD_PROJECT = PROJECT_ID
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: PROJECT_ID,
  storageBucket: BUCKET,
  databaseURL: '',
})

// ── Load secrets from functions/.secret.local if not already in env ──────────
function loadSecrets() {
  const needed = ['PII_ENCRYPTION_KEY', 'HMAC_SECRET_KEY']
  const missing = []

  for (const key of needed) {
    if (process.env[key]) continue

    const secretPath = resolve(__dirname, '..', '.secret.local')
    if (existsSync(secretPath)) {
      for (const line of readFileSync(secretPath, 'utf8').split('\n')) {
        const m = line.match(new RegExp(`^${key}=(.+)$`))
        if (m) {
          process.env[key] = m[1].trim()
          break
        }
      }
    }

    if (!process.env[key]) missing.push(key)
  }

  if (missing.length > 0) {
    console.error(`[run-archive] ERROR: Missing secrets: ${missing.join(', ')}`)
    console.error('  Copy functions/.secret.local.example → functions/.secret.local and fill in the values.')
    process.exit(1)
  }
}

// ── Probe an emulator endpoint to confirm it is reachable ────────────────────
function probeEmulator(host) {
  const [hostname, portStr] = host.split(':')
  const port = Number(portStr)
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname, port, path: '/', timeout: 3000 }, (res) => {
      res.resume()
      resolve()
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

// ── Check compiled lib exists ─────────────────────────────────────────────────
function assertLibBuilt() {
  const libPath = resolve(__dirname, '..', 'lib', 'index.js')
  if (!existsSync(libPath)) {
    console.error('[run-archive] ERROR: functions/lib/index.js not found.')
    console.error('  Run: npm --prefix functions run build')
    process.exit(1)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  assertLibBuilt()
  loadSecrets()

  const fsHost = process.env.FIRESTORE_EMULATOR_HOST
  try {
    await probeEmulator(fsHost)
    console.log(`[run-archive] Firestore emulator reachable at ${fsHost}`)
  } catch {
    console.error(`[run-archive] ERROR: Firestore emulator not reachable at ${fsHost}`)
    console.error('  Start emulators: firebase emulators:start --only auth,firestore,functions,storage')
    process.exit(1)
  }

  const stHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST
  try {
    await probeEmulator(stHost)
    console.log(`[run-archive] Storage emulator reachable at ${stHost}`)
  } catch {
    console.error(`[run-archive] ERROR: Storage emulator not reachable at ${stHost}`)
    console.error('  Start emulators: firebase emulators:start --only auth,firestore,functions,storage')
    process.exit(1)
  }

  console.log('[run-archive] Loading functions module (lib/index.js)…')
  // lib/index.js is CommonJS; require() is synchronous and all env vars above
  // are already set so initializeApp() inside the module sees the emulator config.
  const { runArchiveAndCleanup } = require('../lib/index.js')

  console.log('[run-archive] Running runArchiveAndCleanup()…')
  await runArchiveAndCleanup()
  console.log('[run-archive] Done. Run npm run verify:archive-test to check results.')
}

main().catch(err => {
  console.error('[run-archive] FATAL:', err)
  process.exit(1)
})
