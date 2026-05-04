# Callable Functions Emulator Test Plan

This pass intentionally does not add weak mocks for callable behavior. The next layer should run
against the Firebase Functions and Firestore emulators after the function runtime can be supplied
with local test secrets for `PII_ENCRYPTION_KEY` and `HMAC_SECRET_KEY`.

## Target command

```sh
npm run test:functions
```

Recommended emulator scope:

```sh
firebase emulators:exec --project demo-upeva-test --only auth,firestore,functions "vitest run tests/functions"
```

## Test contracts to add

- `createApplication` rejects invalid CPF, invalid email, invalid status-shaping inputs, and animal/species mismatches.
- `createApplication` creates two concurrent specific-animal applications with stable queue positions `1` and `2`.
- `updateApplicationReview` approval immediately marks the linked animal as `adopted`.
- `updateApplicationReview` blocks re-entry to an adopted or archived animal.
- Admin/reviewer callable rate limiting writes `rateLimits/{uid}_{operation}` with `expiresAt`, no email, no CPF, and no plaintext PII.
- Non-staff callers cannot execute admin/reviewer callables.

## Setup notes

- Seed Firestore through Admin SDK or a rules-disabled test context, not by relying on client writes.
- Invoke callables through the Firebase client SDK against the Functions emulator, not by importing
  function handlers from `functions/src/index.ts`.
- Keep assertions on persisted Firestore state and callable error codes. Do not assert helper names,
  source file paths, or current function export layout.
