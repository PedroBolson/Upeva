import { getFirestore, FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

export const ADMIN_RATE_LIMIT = 100;
export const ADMIN_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function runTxWithRetry<T>(
  fn: (tx: Transaction) => Promise<T>,
  retries = 3,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await getFirestore().runTransaction(fn);
    } catch (err) {
      last = err;
      const code = (err as { code?: string }).code;
      if (code !== "aborted" && code !== "unavailable") throw err;
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, Math.random() * 200 * (i + 1)));
      }
    }
  }
  throw last;
}

// Must be called after auth/permission checks — unauthorised requests must
// never write rateLimit documents. Doc ID: `{uid}_{operation}`, no PII stored.
// expiresAt enables the Firestore TTL policy to auto-delete stale documents.
export async function assertAdminRateLimit(
  uid: string,
  operation: string,
  limit = ADMIN_RATE_LIMIT,
  windowMs = ADMIN_WINDOW_MS,
): Promise<void> {
  const docId = `${uid}_${operation}`;
  const rateLimitRef = getFirestore().collection("rateLimits").doc(docId);
  const now = Date.now();
  const expiresAt = new Timestamp(Math.floor((now + windowMs) / 1000), 0);

  const allowed = await runTxWithRetry(async (tx) => {
    const snap = await tx.get(rateLimitRef);

    if (!snap.exists) {
      tx.set(rateLimitRef, { count: 1, windowStart: now, expiresAt });
      return true;
    }

    const { count, windowStart } = snap.data() as { count: number; windowStart: number };

    if (now - windowStart > windowMs) {
      tx.set(rateLimitRef, { count: 1, windowStart: now, expiresAt });
      return true;
    }

    if (count >= limit) return false;

    tx.update(rateLimitRef, { count: FieldValue.increment(1) });
    return true;
  });

  if (!allowed) {
    logger.warn("Admin rate limit exceeded", { uid, operation });
    throw new HttpsError("resource-exhausted", "Muitas operações. Tente novamente mais tarde.");
  }
}
