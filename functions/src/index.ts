import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { FieldValue, getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functionsV1 from "firebase-functions/v1";
import { encrypt, decrypt, hmac, piiEncryptionKey, hmacSecretKey } from "./lib/crypto.util.js";
import { generatePdf, type AddressData } from "./lib/pdf.helper.js";
import {
  uploadToDrive,
  getYearlyFolderId,
  DRIVE_FOLDERS,
  driveSecret,
} from "./lib/drive.helper.js";

initializeApp();

const db = getFirestore();
const adminAuth = getAuth();
const adminStorage = getStorage();

type UserRole = "admin" | "reviewer";
type ApplicationStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "declined";

type RejectionReason =
  | "inadequate_housing"
  | "no_landlord_permission"
  | "financial_instability"
  | "previous_animal_negligence"
  | "incompatible_lifestyle"
  | "other";

const VALID_REJECTION_REASONS = new Set<RejectionReason>([
  "inadequate_housing",
  "no_landlord_permission",
  "financial_instability",
  "previous_animal_negligence",
  "incompatible_lifestyle",
  "other",
]);

const REJECTION_DETAILS_MIN_LENGTH = 100;
type AnimalStatus = "available" | "under_review" | "adopted" | "archived";
type Species = "dog" | "cat";
type Sex = "male" | "female";
type Size = "small" | "medium" | "large";

type ApplicationRecord = {
  status: ApplicationStatus;
  animalId?: string;
  animalName?: string;
  species: Species;
  preferredSex?: Sex | "any";
  preferredSize?: Size | "any";
  jointAdoption?: boolean;
  adminNotes?: string;
};

type AnimalRecord = {
  name?: string;
  species?: Species;
  sex?: Sex;
  size?: Size;
  status?: AnimalStatus;
  adoptedApplicationId?: string;
  adoptedAt?: unknown;
  activeApplicationCount?: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "reviewer";
}

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return ["pending", "in_review", "approved", "rejected", "withdrawn", "declined"].includes(
    String(value)
  );
}

function isRejectionReason(value: unknown): value is RejectionReason {
  return VALID_REJECTION_REASONS.has(value as RejectionReason);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const PHONE_REGEX = /^\(\d{2}\)\s\d{5}-\d{4}$/;
const CEP_REGEX = /^\d{5}-\d{3}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const VALID_STATES = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(digits[10]);
}

function assertMaxLength(value: string, max: number, field: string): void {
  if (value.length > max) {
    throw new HttpsError("invalid-argument", `${field} excede o limite de ${max} caracteres.`);
  }
}

async function runTransactionWithRetry<T>(
  callback: (tx: Transaction) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await db.runTransaction(callback);
    } catch (err) {
      lastError = err;
      const code = (err as { code?: string }).code;
      if (code !== "aborted" && code !== "unavailable") throw err;
      if (attempt < maxRetries - 1) {
        await new Promise((res) => setTimeout(res, Math.random() * 200 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

async function buildAndCacheSimilarAnimals(
  animalId: string,
  animal: { species: Species; sex?: Sex; size?: Size },
): Promise<void> {
  const COUNT = 4;
  const FETCH_LIMIT = 8;

  type QueryPlan = { species: Species; sex?: Sex; size?: Size };
  const plans: QueryPlan[] = [];
  if (animal.species === "dog" && animal.size) {
    plans.push({ species: animal.species, sex: animal.sex, size: animal.size });
  }
  plans.push({ species: animal.species, sex: animal.sex });
  plans.push({ species: animal.species });

  const seen = new Set<string>();
  const uniquePlans = plans.filter((p) => {
    const key = JSON.stringify(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const matches: Record<string, unknown>[] = [];
  const seenIds = new Set<string>([animalId]);

  for (const plan of uniquePlans) {
    if (matches.length >= COUNT) break;

    const base = db.collection("animals").where("status", "==", "available");
    const withSpecies = base.where("species", "==", plan.species);
    const withSex = plan.sex ? withSpecies.where("sex", "==", plan.sex) : withSpecies;
    const withSize = plan.size ? withSex.where("size", "==", plan.size) : withSex;
    const snap = await withSize.orderBy("createdAt", "desc").limit(FETCH_LIMIT).get();

    for (const docSnap of snap.docs) {
      if (seenIds.has(docSnap.id)) continue;
      seenIds.add(docSnap.id);
      matches.push({ id: docSnap.id, ...docSnap.data() });
      if (matches.length >= COUNT) break;
    }
  }

  await db.collection("animalSimilarityCache").doc(animalId).set({
    items: matches,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function isGeneralInterestApplication(application: ApplicationRecord): boolean {
  if (!application.animalId) return true;
  if (application.species === "dog") {
    return application.preferredSex !== undefined || application.preferredSize !== undefined;
  }
  return application.jointAdoption !== undefined || application.preferredSex !== undefined;
}

function animalMatchesGeneralApplication(application: ApplicationRecord, animal: AnimalRecord): boolean {
  if (application.species !== animal.species) return false;

  if (
    application.preferredSex &&
    application.preferredSex !== "any" &&
    animal.sex !== application.preferredSex
  ) {
    return false;
  }

  if (
    application.species === "dog" &&
    application.preferredSize &&
    application.preferredSize !== "any" &&
    animal.size !== application.preferredSize
  ) {
    return false;
  }

  return true;
}

async function recomputeAnimalState(animalId: string): Promise<void> {
  const animalRef = db.collection("animals").doc(animalId);
  const animalSnap = await animalRef.get();

  if (!animalSnap.exists) return;

  const animal = animalSnap.data() as AnimalRecord;
  // Single query covers all relevant statuses — no extra read needed
  const relevantAppsSnap = await db
    .collection("applications")
    .where("animalId", "==", animalId)
    .where("status", "in", ["pending", "approved", "in_review", "withdrawn"])
    .get();

  const relevantApps = relevantAppsSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as ApplicationRecord),
  }));

  const approvedApps = relevantApps.filter((app) => app.status === "approved");
  const inReviewApps = relevantApps.filter((app) => app.status === "in_review");
  const withdrawnWinner = relevantApps.find(
    (app) => app.id === animal.adoptedApplicationId && app.status === "withdrawn"
  );

  // Count active (pending + in_review) for queue position tracking
  const activeApplicationCount = relevantApps.filter(
    (app) => app.status === "pending" || app.status === "in_review"
  ).length;

  const winner =
    approvedApps.find((app) => app.id === animal.adoptedApplicationId) ?? approvedApps[0] ?? null;

  if (winner) {
    await animalRef.update({
      status: "adopted",
      activeApplicationCount: 0,
      adoptedApplicationId: winner.id,
      adoptedAt: animal.adoptedAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  if (withdrawnWinner) {
    await animalRef.update({
      status: "adopted",
      activeApplicationCount: 0,
      adoptedApplicationId: withdrawnWinner.id,
      adoptedAt: animal.adoptedAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  if (inReviewApps.length > 0) {
    await animalRef.update({
      status: "under_review",
      activeApplicationCount,
      adoptedApplicationId: FieldValue.delete(),
      adoptedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  await animalRef.update({
    status: animal.status === "archived" ? "archived" : "available",
    activeApplicationCount,
    adoptedApplicationId: FieldValue.delete(),
    adoptedAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function recalibrateAnimalQueue(animalId: string): Promise<void> {
  const snap = await db
    .collection("applications")
    .where("animalId", "==", animalId)
    .where("status", "in", ["pending", "in_review"])
    .get();

  if (snap.empty) return;

  const sorted = snap.docs.slice().sort((a, b) => {
    const ap = (a.data().queuePosition as number | undefined) ?? Number.MAX_SAFE_INTEGER;
    const bp = (b.data().queuePosition as number | undefined) ?? Number.MAX_SAFE_INTEGER;
    return ap - bp;
  });

  const batch = db.batch();
  sorted.forEach((doc, i) => {
    const queuePosition = i + 1;
    batch.update(doc.ref, { queuePosition, waitlistEntry: queuePosition > 1 });
  });
  await batch.commit();
}

async function appendToAnimalQueue(animalId: string, appId: string): Promise<void> {
  const snap = await db
    .collection("applications")
    .where("animalId", "==", animalId)
    .where("status", "in", ["pending", "in_review"])
    .get();

  const activeCount = snap.docs.filter((d) => d.id !== appId).length;
  const queuePosition = activeCount + 1;
  await db.collection("applications").doc(appId).update({
    queuePosition,
    waitlistEntry: queuePosition > 1,
  });
}

// ── Trigger deduplication (Melhoria 10) ───────────────────────────────────────
// Uses doc.create() which is atomic and fails if the document already exists,
// preventing duplicate processing of retried Firestore trigger events.
async function markEventProcessed(eventId: string): Promise<boolean> {
  const ref = db.collection("_processedEvents").doc(eventId);
  // expiresAt = 7 days from now — safe margin above the 24h retry window
  const expiresAt = new Timestamp(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, 0);
  try {
    await ref.create({ processedAt: FieldValue.serverTimestamp(), expiresAt });
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
      await adminAuth.setCustomUserClaims(user.uid, { role: roleToSet });
    }
  });

// ── createUser: admin creates a new staff user ────────────────────────────────
export const createUser = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    // Melhoria 3: use token claim instead of a Firestore read
    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can create users.");
    }

    const { email, password, displayName, role } = request.data as {
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
      throw new HttpsError("invalid-argument", "Senha deve ter ao menos 8 caracteres.");
    }
    if (!/[A-Z]/.test(password)) {
      throw new HttpsError("invalid-argument", "Senha deve conter ao menos uma letra maiúscula.");
    }
    if (!/[a-z]/.test(password)) {
      throw new HttpsError("invalid-argument", "Senha deve conter ao menos uma letra minúscula.");
    }
    if (!/[0-9]/.test(password)) {
      throw new HttpsError("invalid-argument", "Senha deve conter ao menos um número.");
    }

    const newUser = await adminAuth.createUser({ email, password, displayName });

    // Set Custom Claims before Firestore write so rules are consistent
    await adminAuth.setCustomUserClaims(newUser.uid, { role });

    await db.collection("users").doc(newUser.uid).set({
      uid: newUser.uid,
      email,
      displayName,
      role,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });

    return { uid: newUser.uid };
  }
);

// ── updateUserRole: admin promotes or demotes another user ────────────────────
export const updateUserRole = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only admins can update roles."
      );
    }

    const { uid, role } = request.data as { uid: string; role: UserRole };

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
    await adminAuth.setCustomUserClaims(uid, { role });

    await db.collection("users").doc(uid).update({
      role,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

// ── createApplication: public callable with server-side validation + rate limit ─
// Rate limit: max 5 submissions per email per 24h.
// Blocks direct client writes so all applications pass through validation.
export const createApplication = onCall(
  { region: "southamerica-east1", maxInstances: 10, secrets: [piiEncryptionKey, hmacSecretKey] },
  async (request) => {
    const data = request.data as Record<string, unknown>;

    // Validate required string fields
    const requiredStrings = [
      "species",
      "fullName",
      "email",
      "cpf",
      "phone",
      "birthDate",
      "cep",
    ];
    for (const field of requiredStrings) {
      if (typeof data[field] !== "string" || !(data[field] as string).trim()) {
        throw new HttpsError(
          "invalid-argument",
          `Campo obrigatório ausente ou inválido: ${field}`
        );
      }
    }

    const rawAnimalId =
      typeof data.animalId === "string" ? (data.animalId as string).trim() : "";
    const rawAnimalName =
      typeof data.animalName === "string" ? (data.animalName as string).trim() : "";
    if (Boolean(rawAnimalId) !== Boolean(rawAnimalName)) {
      throw new HttpsError(
        "invalid-argument",
        "animalId e animalName devem ser enviados juntos."
      );
    }
    const animalId = rawAnimalId || undefined;
    const animalName = rawAnimalName || undefined;
    const fullName = (data.fullName as string).trim();
    assertMaxLength(fullName, 100, "fullName");
    const email = (data.email as string).toLowerCase().trim();
    assertMaxLength(email, 254, "email");
    const cpf = (data.cpf as string).trim();
    const phone = (data.phone as string).trim();
    const birthDate = (data.birthDate as string).trim();
    const cep = (data.cep as string).trim();

    if (!isValidEmail(email)) {
      throw new HttpsError("invalid-argument", "Formato de e-mail inválido.");
    }
    if (!CPF_REGEX.test(cpf)) {
      throw new HttpsError("invalid-argument", "Formato de CPF inválido.");
    }
    if (!isValidCPF(cpf)) {
      throw new HttpsError("invalid-argument", "CPF inválido.");
    }
    if (!PHONE_REGEX.test(phone)) {
      throw new HttpsError("invalid-argument", "Formato de telefone inválido.");
    }
    if (!ISO_DATE_REGEX.test(birthDate)) {
      throw new HttpsError("invalid-argument", "Formato de data de nascimento inválido.");
    }
    if (!CEP_REGEX.test(cep)) {
      throw new HttpsError("invalid-argument", "Formato de CEP inválido.");
    }

    const species = data.species as string;
    if (species !== "dog" && species !== "cat") {
      throw new HttpsError("invalid-argument", "Espécie inválida.");
    }

    const rawAddress = data.address;
    if (!rawAddress || typeof rawAddress !== "object" || Array.isArray(rawAddress)) {
      throw new HttpsError("invalid-argument", "Endereço inválido.");
    }

    const addressData = rawAddress as Record<string, unknown>;
    const requiredAddressFields = ["street", "number", "neighborhood", "city", "state"];
    for (const field of requiredAddressFields) {
      if (typeof addressData[field] !== "string" || !(addressData[field] as string).trim()) {
        throw new HttpsError(
          "invalid-argument",
          `Campo obrigatório ausente ou inválido no endereço: ${field}`
        );
      }
    }

    const address: Record<string, unknown> = {
      street: (addressData.street as string).trim(),
      number: (addressData.number as string).trim(),
      neighborhood: (addressData.neighborhood as string).trim(),
      city: (addressData.city as string).trim(),
      state: (addressData.state as string).trim().toUpperCase(),
    };
    if (!VALID_STATES.has(address.state as string)) {
      throw new HttpsError("invalid-argument", "UF inválida no endereço.");
    }

    assertMaxLength(address.street as string, 150, "address.street");
    assertMaxLength(address.number as string, 20, "address.number");
    assertMaxLength(address.neighborhood as string, 100, "address.neighborhood");
    assertMaxLength(address.city as string, 100, "address.city");

    if (typeof addressData.complement === "string" && addressData.complement.trim()) {
      address.complement = addressData.complement.trim();
      assertMaxLength(address.complement as string, 50, "address.complement");
    }

    // Rate limiting — max 5 applications per email per 24h
    const emailHash = hmac(email).slice(0, 32);
    const rateLimitRef = db.collection("rateLimits").doc(emailHash);
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;

    const allowed = await runTransactionWithRetry(async (tx) => {
      const snap = await tx.get(rateLimitRef);
      // expiresAt enables Firestore TTL policy to auto-delete stale rate limit docs
      const expiresAt = new Timestamp(Math.floor((now + windowMs) / 1000), 0);

      if (!snap.exists) {
        tx.set(rateLimitRef, { count: 1, windowStart: now, expiresAt });
        return true;
      }

      const { count, windowStart } = snap.data() as { count: number; windowStart: number };

      if (now - windowStart > windowMs) {
        tx.set(rateLimitRef, { count: 1, windowStart: now, expiresAt });
        return true;
      }

      if (count >= 5) return false;

      tx.update(rateLimitRef, { count: FieldValue.increment(1) });
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

    if (typeof adoptionReason === "string") assertMaxLength(adoptionReason, 2000, "adoptionReason");
    if (typeof comments === "string") assertMaxLength(comments, 1000, "comments");
    if (typeof previousPets === "string") assertMaxLength(previousPets, 1000, "previousPets");
    if (typeof currentPetsVaccinationReason === "string") assertMaxLength(currentPetsVaccinationReason, 500, "currentPetsVaccinationReason");
    if (typeof scratchBehaviorResponse === "string") assertMaxLength(scratchBehaviorResponse, 1000, "scratchBehaviorResponse");
    if (typeof escapeResponse === "string") assertMaxLength(escapeResponse, 1000, "escapeResponse");
    if (typeof cannotKeepResponse === "string") assertMaxLength(cannotKeepResponse, 1000, "cannotKeepResponse");
    if (typeof longTermCommitment === "string") assertMaxLength(longTermCommitment, 1000, "longTermCommitment");

    let resolvedAnimalName = animalName;
    let waitlistEntry = false;
    let queuePosition = 0;

    if (animalId) {
      const animalSnap = await db.collection("animals").doc(animalId).get();
      if (!animalSnap.exists) {
        throw new HttpsError("not-found", "Animal não encontrado.");
      }

      const animal = animalSnap.data() as AnimalRecord;
      if (animal.species !== species) {
        throw new HttpsError(
          "failed-precondition",
          "A espécie do animal não corresponde à candidatura."
        );
      }

      if (animal.status !== "available" && animal.status !== "under_review") {
        throw new HttpsError(
          "failed-precondition",
          "Este animal não está disponível para novas candidaturas."
        );
      }

      resolvedAnimalName = typeof animal.name === "string" ? animal.name.trim() : animalName;
      if (!resolvedAnimalName) {
        throw new HttpsError("failed-precondition", "Não foi possível identificar o animal.");
      }

      // Live count query — avoids bootstrapping issues with the denormalized counter
      const activeCountSnap = await db
        .collection("applications")
        .where("animalId", "==", animalId)
        .where("status", "in", ["pending", "in_review"])
        .count()
        .get();
      queuePosition = activeCountSnap.data().count + 1;
      waitlistEntry = queuePosition > 1;
    }

    const applicationPayload: Record<string, unknown> = {
      species,
      fullName, email, cep,
      cpf: encrypt(cpf),
      phone: encrypt(phone),
      birthDate: encrypt(birthDate),
      address: encrypt(JSON.stringify(address)),
      adultsCount, childrenCount,
      adoptionReason, hoursHomePeoplePerDay,
      housingType,
      scratchBehaviorResponse, escapeResponse, cannotKeepResponse,
      waitlistEntry,
      queuePosition,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (animalId && resolvedAnimalName) {
      applicationPayload.animalId = animalId;
      applicationPayload.animalName = resolvedAnimalName;
    }

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
    return { id: ref.id, waitlistEntry, queuePosition };
  }
);

export const updateApplicationReview = onCall(
  { region: "southamerica-east1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      throw new HttpsError("permission-denied", "Only staff can review applications.");
    }

    const { id, status } = request.data as {
      id?: string;
      status?: ApplicationStatus;
      adminNotes?: string;
      animalId?: string;
      animalName?: string;
      rejectionReason?: string;
      rejectionDetails?: string;
    };

    if (typeof id !== "string" || !id.trim()) {
      throw new HttpsError("invalid-argument", "ID da candidatura inválido.");
    }

    if (!isApplicationStatus(status)) {
      throw new HttpsError("invalid-argument", "Status da candidatura inválido.");
    }

    const appRef = db.collection("applications").doc(id.trim());

    // DECLINED: delete immediately — no PDF, no flag, no further processing
    if (status === "declined") {
      const snap = await appRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Candidatura não encontrada.");
      }
      await appRef.delete();
      return { success: true };
    }

    // REJECTED: validate required fields before proceeding
    if (status === "rejected") {
      if (!isRejectionReason(request.data.rejectionReason)) {
        throw new HttpsError("invalid-argument", "Motivo de rejeição inválido.");
      }
      const details = typeof request.data.rejectionDetails === "string" ?
        request.data.rejectionDetails.trim() :
        "";
      if (details.length < REJECTION_DETAILS_MIN_LENGTH) {
        throw new HttpsError(
          "invalid-argument",
          `Descrição deve ter no mínimo ${REJECTION_DETAILS_MIN_LENGTH} caracteres.`
        );
      }
    }

    const requestedAnimalId = typeof request.data.animalId === "string" &&
      request.data.animalId.trim() ? request.data.animalId.trim() : undefined;
    const adminNotes = typeof request.data.adminNotes === "string" ?
      request.data.adminNotes.trim() : undefined;
    if (adminNotes !== undefined) assertMaxLength(adminNotes, 2000, "adminNotes");

    let resolvedAnimalId: string | undefined;
    let resolvedAnimalName: string | undefined;

    await db.runTransaction(async (transaction) => {
      const appSnap = await transaction.get(appRef);
      if (!appSnap.exists) {
        throw new HttpsError("not-found", "Candidatura não encontrada.");
      }

      const application = appSnap.data() as ApplicationRecord;
      const isGeneralInterest = isGeneralInterestApplication(application);
      const currentAnimalId = application.animalId;
      let nextAnimalId = currentAnimalId;
      let nextAnimalName = application.animalName;
      let linkedAnimal: AnimalRecord | null = null;

      if (requestedAnimalId && !isGeneralInterest && requestedAnimalId !== currentAnimalId) {
        throw new HttpsError(
          "failed-precondition",
          "Apenas candidaturas gerais podem trocar de animal."
        );
      }

      if (isGeneralInterest && requestedAnimalId) {
        const animalRef = db.collection("animals").doc(requestedAnimalId);
        const animalSnap = await transaction.get(animalRef);

        if (!animalSnap.exists) {
          throw new HttpsError("not-found", "Animal não encontrado.");
        }

        const animal = animalSnap.data() as AnimalRecord;
        if (animal.species !== application.species) {
          throw new HttpsError(
            "failed-precondition",
            "A espécie do animal não corresponde à candidatura."
          );
        }

        const isSameCurrentAnimal = requestedAnimalId === currentAnimalId;
        if (!isSameCurrentAnimal && animal.status !== "available" && animal.status !== "under_review") {
          throw new HttpsError(
            "failed-precondition",
            "Só é possível vincular animais disponíveis ou em análise a uma candidatura geral."
          );
        }

        if (!animalMatchesGeneralApplication(application, animal)) {
          throw new HttpsError(
            "failed-precondition",
            "O animal selecionado não corresponde às preferências desta candidatura."
          );
        }

        nextAnimalId = requestedAnimalId;
        nextAnimalName = typeof animal.name === "string" ? animal.name.trim() : undefined;
        linkedAnimal = animal;
      }

      if (status === "approved") {
        if (!nextAnimalId) {
          throw new HttpsError(
            "failed-precondition",
            "Aprovações exigem um animal vinculado."
          );
        }

        const animalRef = db.collection("animals").doc(nextAnimalId);
        const animalSnap = linkedAnimal ? null : await transaction.get(animalRef);
        const animal = linkedAnimal ?? (animalSnap?.data() as AnimalRecord | undefined);

        if (!animal) {
          throw new HttpsError("not-found", "Animal não encontrado.");
        }

        if (
          typeof animal.adoptedApplicationId === "string" &&
          animal.adoptedApplicationId !== id.trim()
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Este animal já está vinculado a outra adoção concluída."
          );
        }

        const approvedSnap = await transaction.get(
          db.collection("applications")
            .where("animalId", "==", nextAnimalId)
            .where("status", "==", "approved")
        );

        const conflictingApproved = approvedSnap.docs.find((doc) => doc.id !== id.trim());
        if (conflictingApproved) {
          throw new HttpsError(
            "failed-precondition",
            "Já existe outra candidatura aprovada para este animal."
          );
        }
      }

      // Recompute queue position when a new animal is linked to a general interest application
      let newQueuePosition: number | undefined;
      const animalLinkChanged = isGeneralInterest && nextAnimalId && nextAnimalId !== currentAnimalId;
      if (animalLinkChanged) {
        const activeSnap = await transaction.get(
          db.collection("applications")
            .where("animalId", "==", nextAnimalId)
            .where("status", "in", ["pending", "in_review"])
        );
        const activeCount = activeSnap.docs.filter((d) => d.id !== id.trim()).length;
        newQueuePosition = activeCount + 1;
      }

      const payload: Record<string, unknown> = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (status === "rejected") {
        payload.rejectionReason = request.data.rejectionReason;
        payload.rejectionDetails = (request.data.rejectionDetails as string).trim();
        payload.pendingExport = true;
      }

      if (adminNotes !== undefined) {
        payload.adminNotes = adminNotes;
      }

      if (isGeneralInterest && nextAnimalId && nextAnimalName) {
        payload.animalId = nextAnimalId;
        payload.animalName = nextAnimalName;
      }

      if (newQueuePosition !== undefined) {
        payload.queuePosition = newQueuePosition;
        payload.waitlistEntry = newQueuePosition > 1;
      }

      resolvedAnimalId = nextAnimalId;
      resolvedAnimalName = nextAnimalName;
      transaction.update(appRef, payload);
    });

    // When approved, convert other active candidates for the same animal to general interest
    if (status === "approved" && resolvedAnimalId) {
      const [activeSnap, animalSnap] = await Promise.all([
        db.collection("applications")
          .where("animalId", "==", resolvedAnimalId)
          .where("status", "in", ["pending", "in_review"])
          .get(),
        db.collection("animals").doc(resolvedAnimalId).get(),
      ]);
      const animal = animalSnap.data() as AnimalRecord | undefined;
      const others = activeSnap.docs.filter((d) => d.id !== id.trim());
      if (others.length > 0) {
        const batch = db.batch();
        for (const docSnap of others) {
          const appData = docSnap.data() as ApplicationRecord;
          const update: Record<string, unknown> = {
            previousAnimalId: resolvedAnimalId,
            previousAnimalName: resolvedAnimalName ?? null,
            animalId: FieldValue.delete(),
            animalName: FieldValue.delete(),
            queuePosition: FieldValue.delete(),
            waitlistEntry: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          };
          if (animal && !appData.preferredSex) {
            if (animal.sex) update.preferredSex = animal.sex;
          }
          if (animal && appData.species === "dog" && !appData.preferredSize) {
            if (animal.size) update.preferredSize = animal.size;
          }
          batch.update(docSnap.ref, update);
        }
        await batch.commit();
      }
    }

    return { success: true };
  }
);

// ── deleteUser: admin removes a staff user from Auth and Firestore ────────────
export const deleteUser = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can delete users.");
    }

    const { uid } = request.data as { uid: string };

    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "UID inválido.");
    }

    if (uid === request.auth.uid) {
      throw new HttpsError("failed-precondition", "Você não pode excluir sua própria conta.");
    }

    await adminAuth.deleteUser(uid);
    await db.collection("users").doc(uid).delete();

    return { success: true };
  }
);

// ── refreshUserClaims: sets Custom Claims for the calling user ────────────────
// Called automatically on login when the token has no role claim.
// Covers existing users who were created before Custom Claims were deployed.
export const refreshUserClaims = onCall(
  { region: "southamerica-east1", maxInstances: 5 },
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

    await adminAuth.setCustomUserClaims(request.auth.uid, { role });
    return { role };
  }
);

// ── recalibrateCounts: admin-only callable to rebuild metadata/counts ──────────
// Melhoria 6: uses count() aggregation queries instead of full collection scans,
// preventing timeout and memory issues with large collections.
export const recalibrateCounts = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
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

    return { animals: animalCounts, applications: appCounts };
  }
);

// ── recalibrateQueuePositions: backfill queuePosition on all existing apps ─────
// Groups all specific-animal applications by animal, sorts by createdAt ASC,
// and assigns queuePosition = 1, 2, 3… in submission order.
// Safe to re-run — idempotent.
export const recalibrateQueuePositions = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can recalibrate queue positions.");
    }

    // Fetch all applications that are linked to a specific animal
    const appsSnap = await db
      .collection("applications")
      .where("animalId", "!=", null)
      .get();

    if (appsSnap.size > 10_000) {
      throw new HttpsError(
        "resource-exhausted",
        "Muitas candidaturas. Contate o suporte para dividir esta operação.",
      );
    }

    // Group by animalId, sort each group by createdAt ASC, assign positions
    const byAnimal = new Map<string, Array<{ id: string; createdAt: unknown }>>();

    for (const doc of appsSnap.docs) {
      const data = doc.data() as { animalId?: string; createdAt?: unknown };
      if (!data.animalId) continue;
      const group = byAnimal.get(data.animalId) ?? [];
      group.push({ id: doc.id, createdAt: data.createdAt });
      byAnimal.set(data.animalId, group);
    }

    // Sort each group by createdAt (Timestamp seconds, fallback to 0)
    for (const group of byAnimal.values()) {
      group.sort((a, b) => {
        const tsA = (a.createdAt as { seconds?: number })?.seconds ?? 0;
        const tsB = (b.createdAt as { seconds?: number })?.seconds ?? 0;
        return tsA - tsB;
      });
    }

    // Batch write — Firestore limit is 500 ops per batch
    let batch = db.batch();
    let opCount = 0;
    let updatedCount = 0;

    for (const group of byAnimal.values()) {
      for (let i = 0; i < group.length; i++) {
        const ref = db.collection("applications").doc(group[i].id);
        const queuePosition = i + 1;
        const waitlistEntry = queuePosition > 1;
        batch.update(ref, { queuePosition, waitlistEntry });
        opCount++;
        updatedCount++;

        if (opCount >= 499) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    return { updatedCount };
  }
);

// ── updateFeaturedAnimals: admin selects the home page featured animal pool ───
// Reads each selected animal, validates availability, then writes a single
// denormalized cache document at metadata/featuredAnimals. The public home page
// reads that one document instead of doing 50 individual reads per visit.
export const updateFeaturedAnimals = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can update featured animals.");
    }

    const { animalIds } = request.data as { animalIds?: unknown };

    if (!Array.isArray(animalIds)) {
      throw new HttpsError("invalid-argument", "animalIds must be an array.");
    }
    if (animalIds.length > 12) {
      throw new HttpsError("invalid-argument", "Maximum 12 featured animals allowed.");
    }
    if (!animalIds.every((id) => typeof id === "string" && id.length > 0)) {
      throw new HttpsError("invalid-argument", "All entries in animalIds must be non-empty strings.");
    }

    // Deduplicate to prevent duplicate reads and corrupted cache entries
    const ids = [...new Set(animalIds as string[])];

    if (ids.length > 12) {
      throw new HttpsError("invalid-argument", "Maximum 12 featured animals allowed.");
    }

    const validStatuses: AnimalStatus[] = ["available", "under_review"];

    const snapshots = await Promise.all(ids.map((id) => db.collection("animals").doc(id).get()));

    const items: Record<string, unknown>[] = [];
    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      if (!snap.exists) {
        throw new HttpsError("not-found", `Animal "${ids[i]}" not found.`);
      }
      const data = snap.data() as Record<string, unknown>;
      if (!validStatuses.includes(data.status as AnimalStatus)) {
        throw new HttpsError(
          "failed-precondition",
          `Animal "${ids[i]}" is not available for adoption.`
        );
      }
      items.push({ id: snap.id, ...data });
    }

    // updatedBy is intentionally omitted — this document is publicly readable
    // and admin UIDs should not be exposed to anonymous visitors.
    await db.collection("metadata").doc("featuredAnimals").set({
      animalIds: ids,
      items,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
);

// ── onApplicationStatusChanged: sync animal status + maintain counts ───────────
// Melhoria 10: deduplicates retried events using event ID.
export const onApplicationStatusChanged = onDocumentWritten(
  { document: "applications/{appId}", region: "southamerica-east1", maxInstances: 5 },
  async (event) => {
    // Skip if this event was already processed (at-least-once delivery guard)
    const processed = await markEventProcessed(event.id);
    if (!processed) return;

    const before = event.data?.before.data() as
      | { status: ApplicationStatus; animalId?: string }
      | undefined;
    const after = event.data?.after.data() as
      | { status: ApplicationStatus; animalId?: string }
      | undefined;

    const countsRef = db.collection("metadata").doc("counts");

    // ── Maintain application counts ──────────────────────────────────────────
    if (!before && after) {
      // Created
      await countsRef.set(
        { applications: { [after.status]: FieldValue.increment(1), total: FieldValue.increment(1) } },
        { merge: true }
      );
    } else if (before && !after) {
      // Deleted
      await countsRef.set(
        { applications: { [before.status]: FieldValue.increment(-1), total: FieldValue.increment(-1) } },
        { merge: true }
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
        { merge: true }
      );
    }

    // ── Sync animal status and adoption linkage ──────────────────────────────
    const affectedAnimalIds = new Set<string>();

    if (before?.animalId) affectedAnimalIds.add(before.animalId);
    if (after?.animalId) affectedAnimalIds.add(after.animalId);

    const animalLinkChanged = before?.animalId !== after?.animalId;
    const statusChanged = before?.status !== after?.status;

    if (!after && before?.animalId) {
      await recomputeAnimalState(before.animalId);
      // Recalibrate queue when an active application is deleted (e.g. declined)
      if (before.status === "pending" || before.status === "in_review") {
        await recalibrateAnimalQueue(before.animalId);
      }
      return;
    }

    if (!after) return;
    if (!animalLinkChanged && !statusChanged) return;

    for (const animalId of affectedAnimalIds) {
      await recomputeAnimalState(animalId);
    }

    // ── Recalibrate queue positions when the active pool changes ─────────────
    // Candidate leaves: pending/in_review → rejected/withdrawn
    // Candidate re-enters: rejected/withdrawn → pending/in_review
    const activeStatuses: ApplicationStatus[] = ["pending", "in_review"];
    const inactiveStatuses: ApplicationStatus[] = ["rejected", "withdrawn"];
    const isLeaving =
      before?.status !== undefined &&
      after?.status !== undefined &&
      activeStatuses.includes(before.status) &&
      inactiveStatuses.includes(after.status);
    const isReentering =
      before?.status !== undefined &&
      after?.status !== undefined &&
      inactiveStatuses.includes(before.status) &&
      activeStatuses.includes(after.status);

    if (isLeaving && after.animalId) {
      await recalibrateAnimalQueue(after.animalId);
    } else if (isReentering && after.animalId) {
      await appendToAnimalQueue(after.animalId, event.params.appId);
    }
  }
);

// ── onAnimalChanged: maintain metadata/counts.animals ─────────────────────────
// Melhoria 10: deduplicates retried events using event ID.
export const onAnimalChanged = onDocumentWritten(
  { document: "animals/{animalId}", region: "southamerica-east1", maxInstances: 5 },
  async (event) => {
    // Skip if this event was already processed (at-least-once delivery guard)
    const processed = await markEventProcessed(event.id);
    if (!processed) return;

    const before = event.data?.before.data() as { status: AnimalStatus } | undefined;
    const after = event.data?.after.data() as { status: AnimalStatus; species?: Species; sex?: Sex; size?: Size } | undefined;

    const countsRef = db.collection("metadata").doc("counts");

    if (!before && after) {
      // Created
      await countsRef.set(
        { animals: { [after.status]: FieldValue.increment(1), total: FieldValue.increment(1) } },
        { merge: true }
      );
    } else if (before && !after) {
      // Deleted
      await countsRef.set(
        { animals: { [before.status]: FieldValue.increment(-1), total: FieldValue.increment(-1) } },
        { merge: true }
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
        { merge: true }
      );
    }

    // Rebuild similar-animals cache when the animal becomes (un)available
    const animalId = event.params.animalId;
    if (after && (after.status === "available" || after.status === "under_review") && after.species) {
      await buildAndCacheSimilarAnimals(animalId, {
        species: after.species,
        sex: after.sex,
        size: after.size,
      });
    } else {
      // Animal deleted or no longer accessible — remove stale cache entry
      try {
        await db.collection("animalSimilarityCache").doc(animalId).delete();
      } catch (_) {
        // Cache entry may not exist — safe to ignore
      }
    }
  }
);

// ── getApplicationPII: devolve campos sensíveis decifrados para o admin ──────────
// O admin nunca lê CPF/phone/address/birthDate diretamente do Firestore —
// esses campos estão cifrados em repouso. Essa CF decifra server-side e retorna
// apenas os campos PII, separados do documento principal (sem Timestamp issues).
export const getApplicationPII = onCall(
  { region: "southamerica-east1", maxInstances: 10, secrets: [piiEncryptionKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      throw new HttpsError("permission-denied", "Only staff can access PII.");
    }

    const { id } = request.data as { id?: string };
    if (typeof id !== "string" || !id.trim()) {
      throw new HttpsError("invalid-argument", "ID da candidatura inválido.");
    }

    const appSnap = await db.collection("applications").doc(id.trim()).get();
    if (!appSnap.exists) {
      throw new HttpsError("not-found", "Candidatura não encontrada.");
    }

    const data = appSnap.data() as Record<string, unknown>;

    try {
      return {
        cpf: decrypt(data.cpf as string),
        phone: decrypt(data.phone as string),
        birthDate: decrypt(data.birthDate as string),
        address: JSON.parse(decrypt(data.address as string)),
      };
    } catch {
      throw new HttpsError("internal", "Falha ao decifrar dados sensíveis.");
    }
  }
);

// ── archiveAnimal: arquiva um animal com motivo obrigatório ───────────────────
// Status "archived" não pode mais ser definido via Firestore direto — garante
// que arquivamentos sempre registram motivo, detalhes e data do ocorrido.
// O CF também dispara o trigger onAnimalChanged que atualiza metadata/counts.

const VALID_ARCHIVE_REASONS = new Set([
  "death",
  "serious_illness",
  "transfer",
  "other",
]);

export const archiveAnimal = onCall(
  { region: "southamerica-east1", maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      throw new HttpsError("permission-denied", "Only staff can archive animals.");
    }

    const { animalId, archiveReason, archiveDetails, archiveDate } = request.data as {
      animalId?: string;
      archiveReason?: string;
      archiveDetails?: string;
      archiveDate?: string;
    };

    if (typeof animalId !== "string" || !animalId.trim()) {
      throw new HttpsError("invalid-argument", "ID do animal inválido.");
    }
    if (!VALID_ARCHIVE_REASONS.has(archiveReason as string)) {
      throw new HttpsError("invalid-argument", "Motivo de arquivamento inválido.");
    }
    const details = typeof archiveDetails === "string" ? archiveDetails.trim() : "";
    if (details.length < 20) {
      throw new HttpsError("invalid-argument", "Detalhes devem ter no mínimo 20 caracteres.");
    }
    assertMaxLength(details, 1000, "archiveDetails");
    if (typeof archiveDate !== "string" || !ISO_DATE_REGEX.test(archiveDate)) {
      throw new HttpsError("invalid-argument", "Data do ocorrido inválida.");
    }

    const animalRef = db.collection("animals").doc(animalId.trim());
    const animalSnap = await animalRef.get();

    if (!animalSnap.exists) {
      throw new HttpsError("not-found", "Animal não encontrado.");
    }

    const animal = animalSnap.data() as AnimalRecord;
    if (animal.status === "adopted") {
      throw new HttpsError(
        "failed-precondition",
        "Animais adotados não podem ser arquivados diretamente."
      );
    }

    await animalRef.update({
      status: "archived",
      archiveReason,
      archiveDetails: details,
      archiveDate,
      archivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

// ── checkRejectionFlag: verifica se o solicitante de uma candidatura tem flag ──
// Computa hmac(cpf) a partir dos dados da candidatura e consulta rejectionFlags.
// Nunca expõe o CPF — apenas retorna se existe flag e os metadados públicos dela.
export const checkRejectionFlag = onCall(
  { region: "southamerica-east1", maxInstances: 10, secrets: [piiEncryptionKey, hmacSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      throw new HttpsError("permission-denied", "Only staff can check rejection flags.");
    }

    const { applicationId } = request.data as { applicationId?: string };
    if (typeof applicationId !== "string" || !applicationId.trim()) {
      throw new HttpsError("invalid-argument", "ID da candidatura inválido.");
    }

    const appSnap = await db.collection("applications").doc(applicationId.trim()).get();
    if (!appSnap.exists) {
      throw new HttpsError("not-found", "Candidatura não encontrada.");
    }

    const data = appSnap.data() as Record<string, unknown>;

    let rawCpf: string;
    try {
      rawCpf = decrypt(data.cpf as string);
    } catch {
      throw new HttpsError("internal", "Falha ao decifrar CPF para verificação de flag.");
    }

    if (!rawCpf) return { flagged: false };

    const cpfHash = hmac(rawCpf);
    const flagSnap = await db.collection("rejectionFlags").doc(cpfHash).get();

    if (!flagSnap.exists) return { flagged: false };

    const flag = flagSnap.data() as Record<string, unknown>;
    return {
      flagged: true,
      flagId: cpfHash,
      reason: flag.reason ?? null,
      rejectionCount: flag.rejectionCount ?? 1,
      rejectedAt: flag.rejectedAt ?? null,
    };
  }
);

// ── deleteRejectionFlag: remove flag (LGPD Art. 18 — direito ao esquecimento) ──
// Exclusivo para role admin. Registra a deleção no audit log (fase 3.3).
export const deleteRejectionFlag = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can delete rejection flags.");
    }

    const { flagId } = request.data as { flagId?: string };
    if (typeof flagId !== "string" || !flagId.trim()) {
      throw new HttpsError("invalid-argument", "ID da flag inválido.");
    }

    const flagRef = db.collection("rejectionFlags").doc(flagId.trim());
    const flagSnap = await flagRef.get();

    if (!flagSnap.exists) {
      throw new HttpsError("not-found", "Flag não encontrada.");
    }

    await flagRef.delete();
    return { success: true };
  }
);

// ── cleanOperationalData: cron diário às 3h — remove docs TTL residuais ────────
// TTL do Firestore pode ter latência de até 24h. Este cron faz uma segunda
// passagem para garantir deleção de docs que TTL não limpou em tempo hábil.
export const cleanOperationalData = onSchedule(
  { schedule: "0 3 * * *", timeZone: "America/Sao_Paulo", region: "southamerica-east1" },
  async () => {
    const now = Timestamp.now();
    const BATCH_MAX = 400;

    // rateLimits expirados
    const rateLimitsSnap = await db.collection("rateLimits")
      .where("expiresAt", "<=", now)
      .limit(BATCH_MAX)
      .get();

    // _processedEvents expirados
    const processedEventsSnap = await db.collection("_processedEvents")
      .where("expiresAt", "<=", now)
      .limit(BATCH_MAX)
      .get();

    // animalSimilarityCache órfão — animal não existe mais
    const cacheSnap = await db.collection("animalSimilarityCache").limit(500).get();
    const orphanCacheRefs: FirebaseFirestore.DocumentReference[] = [];
    for (const cacheDoc of cacheSnap.docs) {
      const animalSnap = await db.collection("animals").doc(cacheDoc.id).get();
      if (!animalSnap.exists) {
        orphanCacheRefs.push(cacheDoc.ref);
      }
    }

    let batch = db.batch();
    let opCount = 0;

    const addToBatch = async (ref: FirebaseFirestore.DocumentReference) => {
      batch.delete(ref);
      opCount++;
      if (opCount >= BATCH_MAX) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    };

    for (const doc of rateLimitsSnap.docs) await addToBatch(doc.ref);
    for (const doc of processedEventsSnap.docs) await addToBatch(doc.ref);
    for (const ref of orphanCacheRefs) await addToBatch(ref);

    if (opCount > 0) await batch.commit();
  }
);

// ── archiveAndCleanup: cron semanal domingo às 2h — exporta e limpa dados ──────
// Processa em ordem: candidaturas → animais. Cada tipo em lotes de 400.
export const archiveAndCleanup = onSchedule(
  {
    schedule: "0 2 * * 0",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    secrets: [piiEncryptionKey, hmacSecretKey, driveSecret],
  },
  async () => {
    const now = Date.now();
    const DAYS_30 = 30 * 24 * 60 * 60 * 1000;
    const ONG_NAME = "Upeva Adoções";
    const year = new Date().getFullYear();

    function readPII(data: Record<string, unknown>) {
      return {
        cpf: decrypt(data.cpf as string),
        phone: decrypt(data.phone as string),
        birthDate: decrypt(data.birthDate as string),
        address: JSON.parse(decrypt(data.address as string)),
      };
    }

    // ── 1. approved > 30 dias → PDF contrato → Drive → deletar ──────────────
    const approvedCutoff = new Timestamp(Math.floor((now - DAYS_30) / 1000), 0);
    const approvedSnap = await db.collection("applications")
      .where("status", "==", "approved")
      .where("updatedAt", "<=", approvedCutoff)
      .limit(400)
      .get();

    for (const docSnap of approvedSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const pii = readPII(data);
      const folderId = await getYearlyFolderId(DRIVE_FOLDERS.contracts, year);
      const pdfBuffer = await generatePdf("contract", {
        applicationId: docSnap.id,
        fullName: data.fullName as string,
        email: data.email as string,
        cpf: pii.cpf,
        phone: pii.phone,
        birthDate: pii.birthDate,
        address: pii.address as AddressData,
        animalId: (data.animalId as string) ?? "",
        animalName: (data.animalName as string) ?? "Animal",
        species: (data.species as string) ?? "dog",
        approvedAt: (data.updatedAt as Timestamp).toDate(),
        ongName: ONG_NAME,
      });
      const driveUrl = await uploadToDrive(
        pdfBuffer,
        `contrato_${docSnap.id}_${year}.pdf`,
        folderId
      );

      // Deletar animal + fotos do Storage + candidatura (PDF salvo no Drive)
      const animalId = data.animalId as string | undefined;
      if (animalId) {
        const animalSnap = await db.collection("animals").doc(animalId).get();
        if (animalSnap.exists) {
          const animalData = animalSnap.data() as Record<string, unknown>;
          const photos = (animalData.photos as string[]) ?? [];
          await Promise.all(
            photos.map(async (url) => {
              const encodedPath = url.split("/o/")[1]?.split("?")[0];
              if (encodedPath) {
                try {
                  await adminStorage.bucket().file(decodeURIComponent(encodedPath)).delete();
                } catch {
                  // ignore if already deleted
                }
              }
            })
          );
          await animalSnap.ref.delete();
        }
      }
      void driveUrl; // PDF já está no Drive; não há doc para atualizar
      await docSnap.ref.delete();
    }

    // ── 2. rejected + pendingExport → PDF rejeição → Drive → flag → deletar ──
    const rejectedSnap = await db.collection("applications")
      .where("status", "==", "rejected")
      .where("pendingExport", "==", true)
      .limit(400)
      .get();

    for (const docSnap of rejectedSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const pii = readPII(data);
      const folderId = await getYearlyFolderId(DRIVE_FOLDERS.rejections, year);
      const pdfBuffer = await generatePdf("rejection", {
        applicationId: docSnap.id,
        fullName: data.fullName as string,
        email: data.email as string,
        cpf: pii.cpf,
        animalName: data.animalName as string | undefined,
        species: (data.species as string) ?? "dog",
        rejectionReason: data.rejectionReason as string,
        rejectionDetails: data.rejectionDetails as string,
        reviewerName: "Equipe Upeva",
        rejectedAt: (data.updatedAt as Timestamp).toDate(),
        ongName: ONG_NAME,
      });
      const driveUrl = await uploadToDrive(
        pdfBuffer,
        `rejeicao_${docSnap.id}_${year}.pdf`,
        folderId
      );

      // Criar/atualizar flag com HMAC do CPF
      const cpfHash = hmac(pii.cpf);
      const flagRef = db.collection("rejectionFlags").doc(cpfHash);
      const existingFlag = await flagRef.get();
      if (existingFlag.exists) {
        await flagRef.update({
          rejectionCount: (existingFlag.data()?.rejectionCount ?? 0) + 1,
          rejectedAt: FieldValue.serverTimestamp(),
          reason: data.rejectionReason,
          driveUrl,
        });
      } else {
        await flagRef.set({
          emailHash: hmac(data.email as string),
          rejectionCount: 1,
          rejectedAt: FieldValue.serverTimestamp(),
          reason: data.rejectionReason,
          driveUrl,
        });
      }

      await docSnap.ref.delete();
    }

    // ── 3. withdrawn > 30 dias → deletar (sem PDF, sem flag) ────────────────
    const withdrawnCutoff = new Timestamp(Math.floor((now - DAYS_30) / 1000), 0);
    const withdrawnSnap = await db.collection("applications")
      .where("status", "==", "withdrawn")
      .where("updatedAt", "<=", withdrawnCutoff)
      .limit(400)
      .get();

    for (const docSnap of withdrawnSnap.docs) {
      await docSnap.ref.delete();
    }

    // ── 4. archived animals > 30 dias → PDF arquivamento → Drive → deletar ──
    const archivedCutoff = new Timestamp(Math.floor((now - DAYS_30) / 1000), 0);
    const archivedAnimalsSnap = await db.collection("animals")
      .where("status", "==", "archived")
      .where("archivedAt", "<=", archivedCutoff)
      .limit(400)
      .get();

    for (const docSnap of archivedAnimalsSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const folderId = await getYearlyFolderId(DRIVE_FOLDERS.archivedAnimals, year);
      const archiveDate = (data.archiveDate as string) ?? new Date().toISOString().split("T")[0];
      const archivedAt = data.archivedAt instanceof Timestamp ?
        (data.archivedAt as Timestamp).toDate() :
        new Date();

      const pdfBuffer = await generatePdf("archivedAnimal", {
        animalId: docSnap.id,
        animalName: (data.name as string) ?? "Animal",
        species: (data.species as string) ?? "dog",
        sex: data.sex as string | undefined,
        size: data.size as string | undefined,
        // Guard: legado sem motivo usa valor padrão
        archiveReason: (data.archiveReason as string) ?? "Não informado (registro legado)",
        archiveDetails: (data.archiveDetails as string) ?? "Arquivado antes da implementação do novo sistema.",
        archiveDate: new Date(archiveDate),
        archivedAt,
        ongName: ONG_NAME,
      });

      const driveUrl = await uploadToDrive(
        pdfBuffer,
        `animal_${docSnap.id}_${year}.pdf`,
        folderId
      );
      await docSnap.ref.update({ driveUrl });
      await docSnap.ref.delete();
    }

    // ── 5. Recalibrar contadores após deleções ───────────────────────────────
    const animalStatuses = ["available", "under_review", "adopted", "archived"] as const;
    const appStatuses = ["pending", "in_review", "approved", "rejected", "withdrawn"] as const;

    const [animalTotalSnap, ...animalStatusSnaps] = await Promise.all([
      db.collection("animals").count().get(),
      ...animalStatuses.map((s) => db.collection("animals").where("status", "==", s).count().get()),
    ]);
    const [appTotalSnap, ...appStatusSnaps] = await Promise.all([
      db.collection("applications").count().get(),
      ...appStatuses.map((s) => db.collection("applications").where("status", "==", s).count().get()),
    ]);

    const animalCounts: Record<string, number> = { total: animalTotalSnap.data().count };
    animalStatuses.forEach((s, i) => {
      animalCounts[s] = animalStatusSnaps[i].data().count;
    });

    const appCounts: Record<string, number> = { total: appTotalSnap.data().count };
    appStatuses.forEach((s, i) => {
      appCounts[s] = appStatusSnaps[i].data().count;
    });

    await db.collection("metadata").doc("counts").set({ animals: animalCounts, applications: appCounts });
  }
);