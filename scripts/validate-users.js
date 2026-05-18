/**
 * validate-users.js
 *
 * Validates all Firestore `users/{uid}` documents after the production database reset.
 *
 * Checks each document for required fields:
 *   uid, email, displayName, role, emailSearch, displayNameSearch
 *
 * If `emailSearch` is missing, it is generated from: email.trim().toLowerCase()
 * If `displayNameSearch` is missing, it is generated from displayName using the
 * same normalization the app uses:
 *   trim → NFD decompose → strip diacritics → lowercase
 *
 * This fixes the known gap where the bootstrap admin (created via onUserCreated
 * trigger) does not have these search-index fields, making them invisible in
 * the admin user search UI.
 *
 * USAGE
 *   Dry-run (default, safe — no writes):
 *     node scripts/validate-users.js
 *
 *   Write missing search fields:
 *     node scripts/validate-users.js --write
 *
 * CREDENTIALS
 *   Same as reset-db.js — see that file for details.
 *
 * WHAT THIS SCRIPT NEVER DOES
 *   - Never deletes user documents
 *   - Never deletes Firebase Auth users
 *   - Never modifies custom claims
 *   - Never modifies: uid, email, displayName, role, createdAt, createdBy
 *   - Only writes: emailSearch, displayNameSearch (when missing)
 */

import { initializeApp, cert, deleteApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Required fields on every user document ───────────────────────────────────
const REQUIRED_FIELDS = ['uid', 'email', 'displayName', 'role']

// ── Fields this script can generate if missing ───────────────────────────────
const GENERATABLE_FIELDS = ['emailSearch', 'displayNameSearch']

// ── Valid roles ───────────────────────────────────────────────────────────────
const VALID_ROLES = new Set(['admin', 'reviewer'])

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const RED    = (s) => `\x1b[31m${s}\x1b[0m`
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`
const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`
const CYAN   = (s) => `\x1b[36m${s}\x1b[0m`
const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`
const DIM    = (s) => `\x1b[2m${s}\x1b[0m`

// ── Argument parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const WRITE_MODE = args.includes('--write')
const DRY_RUN = !WRITE_MODE

// ── Normalization — matches apps's normalizeSearchText() exactly ──────────────
function normalizeDisplayName(value) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function normalizeEmail(value) {
  return value.trim().toLowerCase()
}

// ── Credentials resolution ────────────────────────────────────────────────────
function resolveCredentials() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv) {
    const resolved = resolve(fromEnv)
    if (!existsSync(resolved)) {
      console.error(RED(`\n✗ GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist:`))
      console.error(RED(`  ${resolved}\n`))
      process.exit(1)
    }
    return { path: resolved, source: 'GOOGLE_APPLICATION_CREDENTIALS env var' }
  }

  const localKey = resolve(ROOT, 'serviceAccountKey.json')
  if (existsSync(localKey)) {
    return { path: localKey, source: './serviceAccountKey.json' }
  }

  console.error(RED('\n✗ No Firebase credentials found.'))
  console.error(RED('  Provide one of:'))
  console.error(RED('    1. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json'))
  console.error(RED('    2. Place serviceAccountKey.json in the project root\n'))
  process.exit(1)
}

// ── Project ID from .firebaserc ───────────────────────────────────────────────
function readProjectId() {
  const rcPath = resolve(ROOT, '.firebaserc')
  if (!existsSync(rcPath)) return null
  try {
    const rc = JSON.parse(readFileSync(rcPath, 'utf8'))
    return rc?.projects?.default ?? null
  } catch {
    return null
  }
}

// ── Analyze a single user document ───────────────────────────────────────────
function analyzeUser(docId, data) {
  const issues = []
  const warnings = []
  const patch = {}

  // Check structural required fields
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      issues.push(`missing required field: ${field}`)
    }
  }

  // Check role is valid
  if (data.role && !VALID_ROLES.has(data.role)) {
    warnings.push(`unexpected role: "${data.role}" (expected: admin, reviewer)`)
  }

  // Check uid matches doc ID
  if (data.uid && data.uid !== docId) {
    issues.push(`uid mismatch: document id="${docId}" but uid field="${data.uid}"`)
  }

  // Generate missing emailSearch
  if (!data.emailSearch) {
    if (data.email) {
      const generated = normalizeEmail(data.email)
      patch.emailSearch = generated
    } else {
      issues.push('missing emailSearch and no email to generate it from')
    }
  }

  // Generate missing displayNameSearch
  if (!data.displayNameSearch) {
    if (data.displayName) {
      const generated = normalizeDisplayName(data.displayName)
      patch.displayNameSearch = generated
    } else {
      issues.push('missing displayNameSearch and no displayName to generate it from')
    }
  }

  const status = issues.length > 0
    ? 'broken'
    : Object.keys(patch).length > 0
      ? 'needs-patch'
      : 'ok'

  return { status, issues, warnings, patch }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('')
  console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(BOLD('  UPEVA — User Document Validation'))
  console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log('')

  if (DRY_RUN) {
    console.log(YELLOW('  MODE: DRY-RUN — no documents will be modified'))
    console.log(DIM('  Pass --write to apply patches for missing search fields'))
  } else {
    console.log(CYAN('  MODE: WRITE — will patch documents with missing search fields'))
  }
  console.log('')

  // Credentials
  const creds = resolveCredentials()
  console.log(DIM(`  Credentials: ${creds.source}`))

  // Project
  const projectId = readProjectId()
  if (!projectId) {
    console.error(RED('\n✗ Could not read project ID from .firebaserc\n'))
    process.exit(1)
  }
  console.log(DIM(`  Project:     ${projectId}`))
  console.log('')

  // Initialize Firebase Admin
  let app
  try {
    const serviceAccount = JSON.parse(readFileSync(creds.path, 'utf8'))
    app = initializeApp({ credential: cert(serviceAccount), projectId })
  } catch (err) {
    console.error(RED(`\n✗ Failed to initialize Firebase Admin: ${err.message}\n`))
    process.exit(1)
  }

  const db = getFirestore(app)

  // Read all user documents (paginated)
  console.log('  Reading users collection...')
  const allUsers = []
  let cursor = null

  while (true) {
    let q = db.collection('users').orderBy('createdAt', 'asc').limit(100)
    if (cursor) q = q.startAfter(cursor)

    const snap = await q.get()
    if (snap.empty) break

    for (const doc of snap.docs) {
      allUsers.push({ id: doc.id, data: doc.data() })
    }

    cursor = snap.docs[snap.docs.length - 1]
    if (snap.docs.length < 100) break
  }

  if (allUsers.length === 0) {
    console.log(YELLOW('\n  No user documents found in the users collection.'))
    console.log(YELLOW('  If this is unexpected, verify the database reset preserved user documents.\n'))
    await deleteApp(app)
    return
  }

  console.log(DIM(`  Found ${allUsers.length} user document(s).`))
  console.log('')
  console.log(BOLD('  USER DOCUMENT ANALYSIS'))
  console.log('')

  const results = {
    ok: [],
    needsPatch: [],
    broken: [],
  }

  for (const { id, data } of allUsers) {
    const { status, issues, warnings, patch } = analyzeUser(id, data)

    const label = data.displayName || data.email || id

    if (status === 'ok') {
      console.log(GREEN(`  ✓ OK         ${label}`))
      console.log(DIM(`               uid=${id}  role=${data.role}`))
      results.ok.push(id)
    } else if (status === 'needs-patch') {
      const patchFields = Object.keys(patch).join(', ')
      console.log(YELLOW(`  ⚠ PATCH      ${label}`))
      console.log(DIM(`               uid=${id}  role=${data.role}`))
      console.log(YELLOW(`               Missing: ${patchFields}`))
      for (const [field, value] of Object.entries(patch)) {
        console.log(DIM(`               → ${field} = "${value}"`))
      }
      if (warnings.length > 0) {
        for (const w of warnings) {
          console.log(YELLOW(`               ⚠ ${w}`))
        }
      }
      results.needsPatch.push({ id, label, patch })
    } else {
      console.log(RED(`  ✗ BROKEN     ${label}`))
      console.log(DIM(`               uid=${id}  role=${data.role ?? '(missing)'}`))
      for (const issue of issues) {
        console.log(RED(`               ✗ ${issue}`))
      }
      if (warnings.length > 0) {
        for (const w of warnings) {
          console.log(YELLOW(`               ⚠ ${w}`))
        }
      }
      results.broken.push({ id, label, issues })
    }

    console.log('')
  }

  // Summary
  console.log(BOLD('  SUMMARY'))
  console.log('')
  console.log(GREEN(`  ✓ OK:           ${results.ok.length}`))
  console.log(YELLOW(`  ⚠ Needs patch:  ${results.needsPatch.length}  ${DIM('(missing emailSearch / displayNameSearch)')}`))
  console.log(RED(`  ✗ Broken:       ${results.broken.length}  ${DIM('(missing required fields or uid mismatch)')}`))
  console.log('')

  // Broken documents need manual intervention — this script cannot fix them
  if (results.broken.length > 0) {
    console.log(RED(BOLD('  ⚠ BROKEN DOCUMENTS REQUIRE MANUAL REVIEW')))
    console.log(RED('  The broken documents above have missing required fields (uid, email, role, etc.)'))
    console.log(RED('  that this script cannot safely reconstruct.'))
    console.log(RED('  Fix them manually in the Firebase Console before launch.'))
    console.log('')
  }

  // Dry-run: stop here
  if (DRY_RUN) {
    if (results.needsPatch.length > 0) {
      console.log(YELLOW(`  ${results.needsPatch.length} document(s) can be patched automatically.`))
      console.log(YELLOW('  Run with --write to apply:'))
      console.log(CYAN('    node scripts/validate-users.js --write'))
    } else {
      console.log(GREEN('  All patchable fields are already present. No writes needed.'))
    }
    console.log('')
    console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log(YELLOW('  DRY-RUN complete. No documents were modified.'))
    console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log('')
    await deleteApp(app)
    if (results.broken.length > 0) process.exit(1)
    return
  }

  // Write mode: patch documents with missing search fields
  if (results.needsPatch.length === 0) {
    console.log(GREEN('  All patchable fields are already present. No writes needed.'))
    console.log('')
    console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log(GREEN('  ✓ Validation complete. No documents needed patching.'))
    console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log('')
    await deleteApp(app)
    if (results.broken.length > 0) process.exit(1)
    return
  }

  console.log(BOLD('  APPLYING PATCHES'))
  console.log('')

  let patchedCount = 0
  let patchFailedCount = 0

  for (const { id, label, patch } of results.needsPatch) {
    try {
      // Use update() — never overwrites existing fields, only adds missing ones.
      // updatedAt is NOT set here intentionally: these are index fields, not
      // business data changes, and we do not want to trigger rules or audits.
      await db.collection('users').doc(id).update(patch)
      console.log(GREEN(`  ✓ Patched: ${label} (${Object.keys(patch).join(', ')})`))
      patchedCount++
    } catch (err) {
      console.error(RED(`  ✗ Failed to patch ${label} (${id}): ${err.message}`))
      patchFailedCount++
    }
  }

  console.log('')
  console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  if (patchFailedCount === 0) {
    console.log(GREEN(BOLD('  ✓ Validation and patching complete.')))
    console.log(GREEN(`  ✓ ${patchedCount} document(s) patched.`))
    if (results.ok.length > 0) console.log(GREEN(`  ✓ ${results.ok.length} document(s) already clean.`))
  } else {
    console.log(YELLOW(`  ⚠ ${patchedCount} patched, ${patchFailedCount} failed.`))
    console.log(RED('    Re-run with --write to retry failed patches.'))
  }
  if (results.broken.length > 0) {
    console.log(RED(`  ✗ ${results.broken.length} broken document(s) still require manual review.`))
  }
  console.log(BOLD('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log('')

  await deleteApp(app)
  if (results.broken.length > 0 || patchFailedCount > 0) process.exit(1)
}

main().catch((err) => {
  console.error(RED(`\n✗ Unexpected error: ${err.message}\n`))
  process.exit(1)
})
