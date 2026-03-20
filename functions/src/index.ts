import {createHash} from "crypto";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as functionsV1 from "firebase-functions/v1";

initializeApp();

const db = getFirestore();
const adminAuth = getAuth();

type UserRole = "admin" | "reviewer";
type ApplicationStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "withdrawn";
type AnimalStatus = "available" | "under_review" | "adopted" | "archived";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "reviewer";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Trigger deduplication (Melhoria 10) ───────────────────────────────────────
// Uses doc.create() which is atomic and fails if the document already exists,
// preventing duplicate processing of retried Firestore trigger events.
async function markEventProcessed(eventId: string): Promise<boolean> {
  const ref = db.collection("_processedEvents").doc(eventId);
  try {
    await ref.create({processedAt: FieldValue.serverTimestamp()});
    return true; // First time — safe to proceed
  } catch {
    return false; // Already processed — skip
  }
}

// ── onUserCreated: mirror Firebase Auth user → Firestore users/{uid} ──────────
// The first mirrored user becomes admin. Later users default to reviewer.
// Custom Claims are set so Firestore/Storage rules can use request.auth.token.role.
export const onUserCreated = functionsV1
  .region("southamerica-east1")
  .auth.user()
  .onCreate(async (user) => {
    const docRef = db.collection("users").doc(user.uid);
    const adminQuery = db
      .collection("users")
      .where("role", "==", "admin")
      .limit(1);

    let roleToSet: UserRole | null = null;

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(docRef);

      if (existing.exists) {
        // Already mirrored — still sync Custom Claims
        const existingRole = existing.data()?.role;
        if (isUserRole(existingRole)) roleToSet = existingRole;
        return;
      }

      const adminUsers = await transaction.get(adminQuery);
      const role: UserRole = adminUsers.empty ? "admin" : "reviewer";
      roleToSet = role;

      transaction.set(docRef, {
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "",
        role,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "system",
      });
    });

    if (roleToSet) {
      await adminAuth.setCustomUserClaims(user.uid, {role: roleToSet});
    }
  });

// ── createUser: admin creates a new staff user ────────────────────────────────
export const createUser = onCall(
  {region: "southamerica-east1", maxInstances: 3},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    // Melhoria 3: use token claim instead of a Firestore read
    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can create users.");
    }

    const {email, password, displayName, role} = request.data as {
      email: string;
      password: string;
      displayName: string;
      role: UserRole;
    };

    if (!email || !password || !displayName || !role) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }
    if (!isValidEmail(email)) {
      throw new HttpsError("invalid-argument", "Invalid email format.");
    }
    if (!isUserRole(role)) {
      throw new HttpsError("invalid-argument", "Invalid role.");
    }
    if (password.length < 8) {
      throw new HttpsError(
        "invalid-argument",
        "Password must be at least 8 characters."
      );
    }

    const newUser = await adminAuth.createUser({email, password, displayName});

    // Set Custom Claims before Firestore write so rules are consistent
    await adminAuth.setCustomUserClaims(newUser.uid, {role});

    await db.collection("users").doc(newUser.uid).set({
      uid: newUser.uid,
      email,
      displayName,
      role,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });

    return {uid: newUser.uid};
  }
);

// ── updateUserRole: admin promotes or demotes another user ────────────────────
export const updateUserRole = onCall(
  {region: "southamerica-east1", maxInstances: 3},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    // Melhoria 3: use token claim instead of a Firestore read
    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only admins can update roles."
      );
    }

    const {uid, role} = request.data as {uid: string; role: UserRole};

    if (!uid || !isUserRole(role)) {
      throw new HttpsError("invalid-argument", "Invalid arguments.");
    }
    if (uid === request.auth.uid) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot change your own role."
      );
    }

    // Update Custom Claims first so Auth rules are consistent immediately
    await adminAuth.setCustomUserClaims(uid, {role});

    await db.collection("users").doc(uid).update({
      role,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {success: true};
  }
);

// ── createApplication: public callable with server-side validation + rate limit ─
// Rate limit: max 5 submissions per email per 24h.
// Blocks direct client writes so all applications pass through validation.
export const createApplication = onCall(
  {region: "southamerica-east1", maxInstances: 10},
  async (request) => {
    const data = request.data as Record<string, unknown>;

    // Validate required string fields
    const requiredStrings = ["animalId", "animalName", "species", "fullName", "email"];
    for (const field of requiredStrings) {
      if (typeof data[field] !== "string" || !(data[field] as string).trim()) {
        throw new HttpsError(
          "invalid-argument",
          `Campo obrigatório ausente ou inválido: ${field}`
        );
      }
    }

    const email = (data.email as string).toLowerCase().trim();
    if (!isValidEmail(email)) {
      throw new HttpsError("invalid-argument", "Formato de e-mail inválido.");
    }

    const species = data.species as string;
    if (species !== "dog" && species !== "cat") {
      throw new HttpsError("invalid-argument", "Espécie inválida.");
    }

    // Rate limiting — max 5 applications per email per 24h
    const emailHash = createHash("sha256").update(email).digest("hex").slice(0, 32);
    const rateLimitRef = db.collection("rateLimits").doc(emailHash);
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;

    const allowed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateLimitRef);

      if (!snap.exists) {
        tx.set(rateLimitRef, {count: 1, windowStart: now});
        return true;
      }

      const {count, windowStart} = snap.data() as {count: number; windowStart: number};

      if (now - windowStart > windowMs) {
        tx.set(rateLimitRef, {count: 1, windowStart: now});
        return true;
      }

      if (count >= 5) return false;

      tx.update(rateLimitRef, {count: FieldValue.increment(1)});
      return true;
    });

    if (!allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "Muitas candidaturas enviadas. Tente novamente amanhã."
      );
    }

    // Melhoria 1: allowlist — only known fields are persisted, arbitrary client
    // fields are discarded before writing to Firestore.
    const {
      animalId, animalName,
      fullName, phone, birthDate, address,
      preferredSex, preferredSize, jointAdoption,
      adultsCount, childrenCount, childrenAges,
      adoptionReason, isGift, hoursHomePeoplePerDay,
      housingType, isRented, landlordAllowsPets,
      hadPetsBefore, previousPets, hasCurrentPets,
      currentPetsCount, currentPetsVaccinated, currentPetsVaccinationReason,
      canAffordCosts, scratchBehaviorResponse, escapeResponse,
      cannotKeepResponse, longTermCommitment,
      acceptsReturnPolicy, acceptsCastrationPolicy, acceptsFollowUp,
      acceptsNoResale, acceptsLiabilityTerms, acceptsResponsibility,
      comments,
    } = data;

    const applicationPayload: Record<string, unknown> = {
      animalId, animalName, species,
      fullName, email, phone, birthDate, address,
      adultsCount, childrenCount,
      adoptionReason, hoursHomePeoplePerDay,
      housingType,
      scratchBehaviorResponse, escapeResponse, cannotKeepResponse,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Optional fields — only include if present to avoid storing undefined
    const optionalFields: Record<string, unknown> = {
      preferredSex, preferredSize, jointAdoption,
      childrenAges, isGift, isRented, landlordAllowsPets,
      hadPetsBefore, previousPets, hasCurrentPets,
      currentPetsCount, currentPetsVaccinated, currentPetsVaccinationReason,
      canAffordCosts, longTermCommitment,
      acceptsReturnPolicy, acceptsCastrationPolicy, acceptsFollowUp,
      acceptsNoResale, acceptsLiabilityTerms, acceptsResponsibility,
      comments,
    };
    for (const [key, value] of Object.entries(optionalFields)) {
      if (value !== undefined) applicationPayload[key] = value;
    }

    const ref = await db.collection("applications").add(applicationPayload);
    return {id: ref.id};
  }
);

// ── refreshUserClaims: sets Custom Claims for the calling user ────────────────
// Called automatically on login when the token has no role claim.
// Covers existing users who were created before Custom Claims were deployed.
export const refreshUserClaims = onCall(
  {region: "southamerica-east1", maxInstances: 5},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const snap = await db.collection("users").doc(request.auth.uid).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const role = snap.data()?.role;
    if (!isUserRole(role)) {
      throw new HttpsError("permission-denied", "Invalid user role.");
    }

    await adminAuth.setCustomUserClaims(request.auth.uid, {role});
    return {role};
  }
);

// ── recalibrateCounts: admin-only callable to rebuild metadata/counts ──────────
// Melhoria 6: uses count() aggregation queries instead of full collection scans,
// preventing timeout and memory issues with large collections.
export const recalibrateCounts = onCall(
  {region: "southamerica-east1", maxInstances: 3},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    // Melhoria 3: use token claim instead of a Firestore read
    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can recalibrate counts.");
    }

    const animalStatuses: AnimalStatus[] = ["available", "under_review", "adopted", "archived"];
    const appStatuses: ApplicationStatus[] = ["pending", "in_review", "approved", "rejected", "withdrawn"];

    // Run all count() queries in parallel — no full scans
    const [animalTotalSnap, ...animalStatusSnaps] = await Promise.all([
      db.collection("animals").count().get(),
      ...animalStatuses.map((s) =>
        db.collection("animals").where("status", "==", s).count().get()
      ),
    ]);

    const [appTotalSnap, ...appStatusSnaps] = await Promise.all([
      db.collection("applications").count().get(),
      ...appStatuses.map((s) =>
        db.collection("applications").where("status", "==", s).count().get()
      ),
    ]);

    const animalCounts: Record<string, number> = {
      total: animalTotalSnap.data().count,
    };
    animalStatuses.forEach((s, i) => {
      animalCounts[s] = animalStatusSnaps[i].data().count;
    });

    const appCounts: Record<string, number> = {
      total: appTotalSnap.data().count,
    };
    appStatuses.forEach((s, i) => {
      appCounts[s] = appStatusSnaps[i].data().count;
    });

    await db.collection("metadata").doc("counts").set({
      animals: animalCounts,
      applications: appCounts,
    });

    return {animals: animalCounts, applications: appCounts};
  }
);

// ── onApplicationStatusChanged: sync animal status + maintain counts ───────────
// Melhoria 10: deduplicates retried events using event ID.
export const onApplicationStatusChanged = onDocumentWritten(
  {document: "applications/{appId}", region: "southamerica-east1", maxInstances: 5},
  async (event) => {
    // Skip if this event was already processed (at-least-once delivery guard)
    const processed = await markEventProcessed(event.id);
    if (!processed) return;

    const before = event.data?.before.data() as
      | {status: ApplicationStatus; animalId?: string}
      | undefined;
    const after = event.data?.after.data() as
      | {status: ApplicationStatus; animalId?: string}
      | undefined;

    const countsRef = db.collection("metadata").doc("counts");

    // ── Maintain application counts ──────────────────────────────────────────
    if (!before && after) {
      // Created
      await countsRef.set(
        {applications: {[after.status]: FieldValue.increment(1), total: FieldValue.increment(1)}},
        {merge: true}
      );
    } else if (before && !after) {
      // Deleted
      await countsRef.set(
        {applications: {[before.status]: FieldValue.increment(-1), total: FieldValue.increment(-1)}},
        {merge: true}
      );
    } else if (before && after && before.status !== after.status) {
      // Status changed
      await countsRef.set(
        {
          applications: {
            [before.status]: FieldValue.increment(-1),
            [after.status]: FieldValue.increment(1),
          },
        },
        {merge: true}
      );
    }

    // ── Sync animal status ────────────────────────────────────────────────────
    if (!after) return; // document deleted
    if (before?.status === after.status) return; // status unchanged

    const animalId = after.animalId;
    if (!animalId) return; // general adoption form — no specific animal

    const animalRef = db.collection("animals").doc(animalId);
    let newAnimalStatus: AnimalStatus | null = null;

    if (after.status === "in_review") {
      newAnimalStatus = "under_review";
    } else if (after.status === "approved") {
      newAnimalStatus = "adopted";
    } else if (after.status === "rejected" || after.status === "withdrawn") {
      const activeApps = await db
        .collection("applications")
        .where("animalId", "==", animalId)
        .where("status", "in", ["pending", "in_review"])
        .get();

      if (activeApps.empty) {
        newAnimalStatus = "available";
      }
    }

    if (newAnimalStatus) {
      await animalRef.update({
        status: newAnimalStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);

// ── onAnimalChanged: maintain metadata/counts.animals ─────────────────────────
// Melhoria 10: deduplicates retried events using event ID.
export const onAnimalChanged = onDocumentWritten(
  {document: "animals/{animalId}", region: "southamerica-east1", maxInstances: 5},
  async (event) => {
    // Skip if this event was already processed (at-least-once delivery guard)
    const processed = await markEventProcessed(event.id);
    if (!processed) return;

    const before = event.data?.before.data() as {status: AnimalStatus} | undefined;
    const after = event.data?.after.data() as {status: AnimalStatus} | undefined;

    const countsRef = db.collection("metadata").doc("counts");

    if (!before && after) {
      // Created
      await countsRef.set(
        {animals: {[after.status]: FieldValue.increment(1), total: FieldValue.increment(1)}},
        {merge: true}
      );
    } else if (before && !after) {
      // Deleted
      await countsRef.set(
        {animals: {[before.status]: FieldValue.increment(-1), total: FieldValue.increment(-1)}},
        {merge: true}
      );
    } else if (before && after && before.status !== after.status) {
      // Status changed
      await countsRef.set(
        {
          animals: {
            [before.status]: FieldValue.increment(-1),
            [after.status]: FieldValue.increment(1),
          },
        },
        {merge: true}
      );
    }
  }
);
