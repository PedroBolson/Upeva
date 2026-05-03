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
  driveSecrets,
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
type HousingType =
  | "house_open_yard"
  | "house_closed_yard"
  | "house_no_yard"
  | "apartment_no_screens"
  | "apartment_with_screens"
  | "apartment";
type PreferredSex = Sex | "any";
type PreferredSize = Size | "any";

type ApplicationAddressInput = {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
};

type ValidatedApplicationInput = {
  animalId?: string;
  animalName?: string;
  species: Species;
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
  birthDate: string;
  cep: string;
  address: ApplicationAddressInput;
  preferredSex?: PreferredSex;
  preferredSize?: PreferredSize;
  jointAdoption?: boolean;
  adultsCount: number;
  childrenCount: number;
  childrenAges?: string;
  adoptionReason: string;
  isGift?: boolean;
  hoursHomePeoplePerDay: number;
  housingType: HousingType;
  isRented: boolean;
  landlordAllowsPets?: boolean;
  hadPetsBefore: boolean;
  previousPets?: string;
  hasCurrentPets: boolean;
  currentPetsCount?: number;
  currentPetsVaccinated?: boolean;
  currentPetsVaccinationReason?: string;
  canAffordCosts: boolean;
  scratchBehaviorResponse: string;
  escapeResponse: string;
  cannotKeepResponse: string;
  longTermCommitment: boolean;
  acceptsReturnPolicy: boolean;
  acceptsCastrationPolicy: boolean;
  acceptsFollowUp: boolean;
  acceptsNoResale: boolean;
  acceptsLiabilityTerms: boolean;
  acceptsResponsibility: boolean;
  comments?: string;
};

type ApplicationRecord = {
  status: ApplicationStatus;
  animalId?: string;
  animalName?: string;
  species: Species;
  preferredSex?: Sex | "any";
  preferredSize?: Size | "any";
  jointAdoption?: boolean;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedByLabel?: string;
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

function isAnimalStatus(value: unknown): value is AnimalStatus {
  return ["available", "under_review", "adopted", "archived"].includes(String(value));
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
const VALID_SPECIES = new Set<Species>(["dog", "cat"]);
const VALID_PREFERRED_SEX = new Set<PreferredSex>(["male", "female", "any"]);
const VALID_PREFERRED_SIZE = new Set<PreferredSize>(["small", "medium", "large", "any"]);
const VALID_HOUSING_TYPES = new Set<HousingType>([
  "house_open_yard",
  "house_closed_yard",
  "house_no_yard",
  "apartment_no_screens",
  "apartment_with_screens",
  "apartment",
]);

const INTERNAL_TRACEABILITY_FIELDS = [
  "createdBy",
  "updatedBy",
  "updatedByLabel",
  "reviewedBy",
  "reviewedByLabel",
  "reviewedAt",
  "reviewAction",
  "archiveReason",
  "archiveDetails",
  "archiveDate",
  "archivedBy",
  "archivedByLabel",
  "roleUpdatedBy",
  "roleUpdatedByLabel",
  "roleUpdatedAt",
];

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

function assertMinLength(value: string, min: number, field: string): void {
  if (value.length < min) {
    throw new HttpsError("invalid-argument", `${field} deve ter ao menos ${min} caracteres.`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stripInternalTraceability(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };
  for (const field of INTERNAL_TRACEABILITY_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

function getActorLabel(auth: { token?: { name?: unknown; email?: unknown } }): string | undefined {
  const name = typeof auth.token?.name === "string" ? auth.token.name.trim() : "";
  if (name) return name;

  const email = typeof auth.token?.email === "string" ? auth.token.email.trim() : "";
  return email || undefined;
}

function requiredString(
  data: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number } = {},
): string {
  const value = data[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `Campo obrigatório ausente ou inválido: ${field}`);
  }

  const trimmed = value.trim();
  if (options.min !== undefined) assertMinLength(trimmed, options.min, field);
  if (options.max !== undefined) assertMaxLength(trimmed, options.max, field);
  return trimmed;
}

function optionalString(
  data: Record<string, unknown>,
  field: string,
  options: { max?: number } = {},
): string | undefined {
  const value = data[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `Campo inválido: ${field}`);
  }

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (options.max !== undefined) assertMaxLength(trimmed, options.max, field);
  return trimmed;
}

function requiredBoolean(data: Record<string, unknown>, field: string): boolean {
  const value = data[field];
  if (typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", `Campo obrigatório ausente ou inválido: ${field}`);
  }
  return value;
}

function optionalBoolean(data: Record<string, unknown>, field: string): boolean | undefined {
  const value = data[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", `Campo inválido: ${field}`);
  }
  return value;
}

function coerceInteger(value: unknown, field: string): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(numeric)) {
    throw new HttpsError("invalid-argument", `Campo obrigatório ausente ou inválido: ${field}`);
  }
  return numeric;
}

function requiredInteger(
  data: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number } = {},
): number {
  const numeric = coerceInteger(data[field], field);
  if (options.min !== undefined && numeric < options.min) {
    throw new HttpsError("invalid-argument", `${field} deve ser no mínimo ${options.min}.`);
  }
  if (options.max !== undefined && numeric > options.max) {
    throw new HttpsError("invalid-argument", `${field} deve ser no máximo ${options.max}.`);
  }
  return numeric;
}

function optionalInteger(
  data: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number } = {},
): number | undefined {
  const value = data[field];
  if (value === undefined || value === null || value === "") return undefined;
  const numeric = coerceInteger(value, field);
  if (options.min !== undefined && numeric < options.min) {
    throw new HttpsError("invalid-argument", `${field} deve ser no mínimo ${options.min}.`);
  }
  if (options.max !== undefined && numeric > options.max) {
    throw new HttpsError("invalid-argument", `${field} deve ser no máximo ${options.max}.`);
  }
  return numeric;
}

function assertTrue(value: boolean, field: string, message: string): void {
  if (value !== true) {
    throw new HttpsError("invalid-argument", message || `Confirme o campo ${field}.`);
  }
}

function isValidISODate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function validateApplicationInput(rawData: unknown): ValidatedApplicationInput {
  if (!isPlainObject(rawData)) {
    throw new HttpsError("invalid-argument", "Dados da candidatura inválidos.");
  }

  const data = rawData;
  const species = requiredString(data, "species");
  if (!VALID_SPECIES.has(species as Species)) {
    throw new HttpsError("invalid-argument", "Espécie inválida.");
  }

  const rawAnimalId = optionalString(data, "animalId", { max: 160 });
  const rawAnimalName = optionalString(data, "animalName", { max: 100 });
  if (Boolean(rawAnimalId) !== Boolean(rawAnimalName)) {
    throw new HttpsError("invalid-argument", "animalId e animalName devem ser enviados juntos.");
  }
  const hasSpecificAnimal = Boolean(rawAnimalId);

  const fullName = requiredString(data, "fullName", { min: 3, max: 100 });
  const email = requiredString(data, "email", { max: 254 }).toLowerCase();
  const cpf = requiredString(data, "cpf");
  const phone = requiredString(data, "phone");
  const birthDate = requiredString(data, "birthDate");
  const cep = requiredString(data, "cep");

  if (!isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "Formato de e-mail inválido.");
  }
  if (!CPF_REGEX.test(cpf) || !isValidCPF(cpf)) {
    throw new HttpsError("invalid-argument", "CPF inválido.");
  }
  if (!PHONE_REGEX.test(phone)) {
    throw new HttpsError("invalid-argument", "Formato de telefone inválido.");
  }
  if (!isValidISODate(birthDate)) {
    throw new HttpsError("invalid-argument", "Data de nascimento inválida.");
  }
  if (!CEP_REGEX.test(cep)) {
    throw new HttpsError("invalid-argument", "Formato de CEP inválido.");
  }

  const rawAddress = data.address;
  if (!isPlainObject(rawAddress)) {
    throw new HttpsError("invalid-argument", "Endereço inválido.");
  }

  const address: ApplicationAddressInput = {
    street: requiredString(rawAddress, "street", { max: 150 }),
    number: requiredString(rawAddress, "number", { max: 20 }),
    neighborhood: requiredString(rawAddress, "neighborhood", { max: 100 }),
    city: requiredString(rawAddress, "city", { max: 100 }),
    state: requiredString(rawAddress, "state").toUpperCase(),
  };
  if (!VALID_STATES.has(address.state)) {
    throw new HttpsError("invalid-argument", "UF inválida no endereço.");
  }
  const complement = optionalString(rawAddress, "complement", { max: 50 });
  if (complement) address.complement = complement;

  const preferredSex = optionalString(data, "preferredSex") as PreferredSex | undefined;
  if (preferredSex && !VALID_PREFERRED_SEX.has(preferredSex)) {
    throw new HttpsError("invalid-argument", "Preferência de sexo inválida.");
  }

  const preferredSize = optionalString(data, "preferredSize") as PreferredSize | undefined;
  if (preferredSize && !VALID_PREFERRED_SIZE.has(preferredSize)) {
    throw new HttpsError("invalid-argument", "Preferência de porte inválida.");
  }

  const jointAdoption = optionalBoolean(data, "jointAdoption");
  if (!hasSpecificAnimal) {
    if (!preferredSex) {
      throw new HttpsError("invalid-argument", "Selecione uma preferência de sexo.");
    }
    if (species === "dog" && !preferredSize) {
      throw new HttpsError("invalid-argument", "Selecione uma preferência de porte.");
    }
    if (species === "cat" && jointAdoption === undefined) {
      throw new HttpsError("invalid-argument", "Informe se deseja adoção conjunta.");
    }
  }

  const adultsCount = requiredInteger(data, "adultsCount", { min: 1 });
  const childrenCount = requiredInteger(data, "childrenCount", { min: 0 });
  const childrenAges = optionalString(data, "childrenAges", { max: 200 });
  if (childrenCount > 0 && !childrenAges) {
    throw new HttpsError("invalid-argument", "Informe as idades das crianças.");
  }

  const adoptionReason = requiredString(data, "adoptionReason", { min: 10, max: 2000 });
  const hoursHomePeoplePerDay = requiredInteger(data, "hoursHomePeoplePerDay", {
    min: 0,
    max: 24,
  });
  const isGift = optionalBoolean(data, "isGift");
  if (species === "cat" && isGift === undefined) {
    throw new HttpsError("invalid-argument", "Informe se a adoção é um presente.");
  }

  const housingType = requiredString(data, "housingType") as HousingType;
  if (!VALID_HOUSING_TYPES.has(housingType)) {
    throw new HttpsError("invalid-argument", "Tipo de moradia inválido.");
  }
  const isRented = requiredBoolean(data, "isRented");
  const landlordAllowsPets = optionalBoolean(data, "landlordAllowsPets");
  if (isRented && landlordAllowsPets === undefined) {
    throw new HttpsError("invalid-argument", "Informe se o proprietário permite animais.");
  }

  const hadPetsBefore = requiredBoolean(data, "hadPetsBefore");
  const previousPets = optionalString(data, "previousPets", { max: 1000 });
  if (hadPetsBefore && !previousPets) {
    throw new HttpsError("invalid-argument", "Descreva os animais que já teve.");
  }

  const hasCurrentPets = requiredBoolean(data, "hasCurrentPets");
  const currentPetsCount = optionalInteger(data, "currentPetsCount", { min: 1 });
  const currentPetsVaccinated = optionalBoolean(data, "currentPetsVaccinated");
  const currentPetsVaccinationReason = optionalString(data, "currentPetsVaccinationReason", {
    max: 500,
  });
  if (hasCurrentPets) {
    if (!currentPetsCount) {
      throw new HttpsError("invalid-argument", "Informe quantos animais tem.");
    }
    if (species === "cat" && currentPetsVaccinated === undefined) {
      throw new HttpsError("invalid-argument", "Informe se os animais são vacinados.");
    }
    if (currentPetsVaccinated === false && !currentPetsVaccinationReason) {
      throw new HttpsError("invalid-argument", "Explique por que os animais não são vacinados.");
    }
  }

  const canAffordCosts = requiredBoolean(data, "canAffordCosts");
  assertTrue(
    canAffordCosts,
    "canAffordCosts",
    "Confirme que pode arcar com os custos de veterinário e alimentação.",
  );
  const scratchBehaviorResponse = requiredString(data, "scratchBehaviorResponse", {
    min: 5,
    max: 1000,
  });
  const escapeResponse = requiredString(data, "escapeResponse", { min: 5, max: 1000 });
  const cannotKeepResponse = requiredString(data, "cannotKeepResponse", { min: 5, max: 1000 });
  const longTermCommitment = requiredBoolean(data, "longTermCommitment");
  assertTrue(
    longTermCommitment,
    "longTermCommitment",
    "Confirme o compromisso de cuidar do animal por toda a vida.",
  );

  const acceptsReturnPolicy = requiredBoolean(data, "acceptsReturnPolicy");
  const acceptsCastrationPolicy = requiredBoolean(data, "acceptsCastrationPolicy");
  const acceptsFollowUp = requiredBoolean(data, "acceptsFollowUp");
  const acceptsNoResale = requiredBoolean(data, "acceptsNoResale");
  const acceptsLiabilityTerms = requiredBoolean(data, "acceptsLiabilityTerms");
  const acceptsResponsibility = requiredBoolean(data, "acceptsResponsibility");
  assertTrue(acceptsReturnPolicy, "acceptsReturnPolicy", "Aceite a política de devolução.");
  assertTrue(acceptsCastrationPolicy, "acceptsCastrationPolicy", "Aceite o compromisso de castração.");
  assertTrue(acceptsFollowUp, "acceptsFollowUp", "Aceite o acompanhamento pós-adoção.");
  assertTrue(acceptsNoResale, "acceptsNoResale", "Aceite não repassar o animal.");
  assertTrue(acceptsLiabilityTerms, "acceptsLiabilityTerms", "Aceite os termos de responsabilidade.");
  assertTrue(acceptsResponsibility, "acceptsResponsibility", "Confirme sua responsabilidade.");

  return {
    animalId: rawAnimalId,
    animalName: rawAnimalName,
    species: species as Species,
    fullName,
    email,
    cpf,
    phone,
    birthDate,
    cep,
    address,
    preferredSex,
    preferredSize,
    jointAdoption,
    adultsCount,
    childrenCount,
    childrenAges,
    adoptionReason,
    isGift,
    hoursHomePeoplePerDay,
    housingType,
    isRented,
    landlordAllowsPets,
    hadPetsBefore,
    previousPets,
    hasCurrentPets,
    currentPetsCount,
    currentPetsVaccinated,
    currentPetsVaccinationReason,
    canAffordCosts,
    scratchBehaviorResponse,
    escapeResponse,
    cannotKeepResponse,
    longTermCommitment,
    acceptsReturnPolicy,
    acceptsCastrationPolicy,
    acceptsFollowUp,
    acceptsNoResale,
    acceptsLiabilityTerms,
    acceptsResponsibility,
    comments: optionalString(data, "comments", { max: 1000 }),
  };
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
      matches.push({ id: docSnap.id, ...stripInternalTraceability(docSnap.data()) });
      if (matches.length >= COUNT) break;
    }
  }

  await db.collection("animalSimilarityCache").doc(animalId).set({
    items: matches,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function removeFromFeaturedAnimalsCache(animalId: string): Promise<void> {
  const featuredRef = db.collection("metadata").doc("featuredAnimals");

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(featuredRef);
    if (!snap.exists) return;

    const data = snap.data() as {
      animalIds?: unknown;
      items?: unknown;
    };
    const animalIds = Array.isArray(data.animalIds) ?
      data.animalIds.filter((id): id is string => typeof id === "string" && id !== animalId) :
      [];
    const items = Array.isArray(data.items) ?
      data.items.filter((item) => {
        if (!isPlainObject(item)) return false;
        return item.id !== animalId &&
          (item.status === "available" || item.status === "under_review");
      }) :
      [];

    tx.set(featuredRef, {
      animalIds,
      items,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
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
    const update: Record<string, unknown> = {
      status: "adopted",
      activeApplicationCount: 0,
      adoptedApplicationId: winner.id,
      adoptedAt: animal.adoptedAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (winner.reviewedBy) update.updatedBy = winner.reviewedBy;
    if (winner.reviewedByLabel) update.updatedByLabel = winner.reviewedByLabel;
    await animalRef.update(update);
    return;
  }

  if (withdrawnWinner) {
    const update: Record<string, unknown> = {
      status: "adopted",
      activeApplicationCount: 0,
      adoptedApplicationId: withdrawnWinner.id,
      adoptedAt: animal.adoptedAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (withdrawnWinner.reviewedBy) update.updatedBy = withdrawnWinner.reviewedBy;
    if (withdrawnWinner.reviewedByLabel) update.updatedByLabel = withdrawnWinner.reviewedByLabel;
    await animalRef.update(update);
    return;
  }

  if (inReviewApps.length > 0) {
    await animalRef.update({
      status: "under_review",
      activeApplicationCount,
      adoptedApplicationId: FieldValue.delete(),
      adoptedAt: FieldValue.delete(),
      updatedBy: FieldValue.delete(),
      updatedByLabel: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  await animalRef.update({
    status: animal.status === "archived" ? "archived" : "available",
    activeApplicationCount,
    adoptedApplicationId: FieldValue.delete(),
    adoptedAt: FieldValue.delete(),
    updatedBy: FieldValue.delete(),
    updatedByLabel: FieldValue.delete(),
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

function getStoragePathFromDownloadUrl(url: string): string | null {
  const encodedPath = url.split("/o/")[1]?.split("?")[0];
  return encodedPath ? decodeURIComponent(encodedPath) : null;
}

async function deleteStorageFilesFromUrls(urls: unknown): Promise<void> {
  if (!Array.isArray(urls)) return;

  await Promise.all(
    urls
      .filter((url): url is string => typeof url === "string" && url.length > 0)
      .map(async (url) => {
        const path = getStoragePathFromDownloadUrl(url);
        if (!path) return;

        try {
          await adminStorage.bucket().file(path).delete();
        } catch {
          // File may already be gone; cleanup must stay idempotent.
        }
      })
  );
}

// ── onUserCreated: mirror Firebase Auth user → Firestore users/{uid} ──────────
// The first mirrored user becomes admin for bootstrap. Later users do not receive
// an automatic staff role; they must be created through createUser by an admin.
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
      if (!adminUsers.empty) {
        return;
      }

      transaction.set(docRef, {
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "",
        role: "admin",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: "system",
        roleUpdatedAt: FieldValue.serverTimestamp(),
        roleUpdatedBy: "system",
        roleUpdatedByLabel: "Sistema",
      });
      roleToSet = "admin";
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

    const actorLabel = getActorLabel(request.auth);
    const newUser = await adminAuth.createUser({ email, password, displayName });
    const userPayload: Record<string, unknown> = {
      uid: newUser.uid,
      email,
      displayName,
      role,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
      roleUpdatedAt: FieldValue.serverTimestamp(),
      roleUpdatedBy: request.auth.uid,
    };
    if (actorLabel) {
      userPayload.updatedByLabel = actorLabel;
      userPayload.roleUpdatedByLabel = actorLabel;
    }

    try {
      await db.collection("users").doc(newUser.uid).set(userPayload);

      await adminAuth.setCustomUserClaims(newUser.uid, { role });
    } catch (err) {
      await adminAuth.deleteUser(newUser.uid).catch(() => undefined);
      throw err;
    }

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

    const actorLabel = getActorLabel(request.auth);
    const payload: Record<string, unknown> = {
      role,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
      roleUpdatedAt: FieldValue.serverTimestamp(),
      roleUpdatedBy: request.auth.uid,
    };
    if (actorLabel) {
      payload.updatedByLabel = actorLabel;
      payload.roleUpdatedByLabel = actorLabel;
    }

    await db.collection("users").doc(uid).update(payload);

    return { success: true };
  }
);

// ── createApplication: public callable with server-side validation + rate limit ─
// Rate limit: max 5 submissions per email per 24h.
// Blocks direct client writes so all applications pass through validation.
export const createApplication = onCall(
  { region: "southamerica-east1", maxInstances: 10, secrets: [piiEncryptionKey, hmacSecretKey] },
  async (request) => {
    const data = validateApplicationInput(request.data);
    const {
      animalId,
      animalName,
      species,
      fullName,
      email,
      cpf,
      phone,
      birthDate,
      cep,
      address,
    } = data;

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
    const actorUid = request.auth.uid;
    const actorLabel = getActorLabel(request.auth);

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
        updatedBy: actorUid,
      };
      if (actorLabel) payload.updatedByLabel = actorLabel;

      if (status === "approved" || status === "rejected" || status === "withdrawn") {
        payload.reviewedBy = actorUid;
        payload.reviewedAt = FieldValue.serverTimestamp();
        payload.reviewAction = status;
        if (actorLabel) payload.reviewedByLabel = actorLabel;
      }

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
            updatedBy: actorUid,
          };
          if (actorLabel) update.updatedByLabel = actorLabel;
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
      items.push({ id: snap.id, ...stripInternalTraceability(data) });
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
        await removeFromFeaturedAnimalsCache(animalId);
      } catch {
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

    const actorLabel = getActorLabel(request.auth);
    const payload: Record<string, unknown> = {
      status: "archived",
      archiveReason,
      archiveDetails: details,
      archiveDate,
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    };
    if (actorLabel) {
      payload.archivedByLabel = actorLabel;
      payload.updatedByLabel = actorLabel;
    }

    await animalRef.update(payload);

    return { success: true };
  }
);

// ── updateAnimalStatus: status changes that need server-side cleanup ─────────
// Public-readable statuses must not retain staff UID traceability from previous
// archived/adopted states.
export const updateAnimalStatus = onCall(
  { region: "southamerica-east1", maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      throw new HttpsError("permission-denied", "Only staff can update animal status.");
    }

    const { animalId, status } = request.data as {
      animalId?: string;
      status?: AnimalStatus;
    };

    if (typeof animalId !== "string" || !animalId.trim()) {
      throw new HttpsError("invalid-argument", "ID do animal inválido.");
    }
    if (!isAnimalStatus(status)) {
      throw new HttpsError("invalid-argument", "Status do animal inválido.");
    }
    if (status === "archived") {
      throw new HttpsError(
        "failed-precondition",
        "Use archiveAnimal para arquivar animais com motivo obrigatório."
      );
    }

    const animalRef = db.collection("animals").doc(animalId.trim());
    const animalSnap = await animalRef.get();
    if (!animalSnap.exists) {
      throw new HttpsError("not-found", "Animal não encontrado.");
    }

    const update: Record<string, unknown> = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (status === "adopted") {
      const actorLabel = getActorLabel(request.auth);
      update.updatedBy = request.auth.uid;
      if (actorLabel) update.updatedByLabel = actorLabel;
    } else {
      update.updatedBy = FieldValue.delete();
      update.updatedByLabel = FieldValue.delete();
      update.archiveReason = FieldValue.delete();
      update.archiveDetails = FieldValue.delete();
      update.archiveDate = FieldValue.delete();
      update.archivedBy = FieldValue.delete();
      update.archivedByLabel = FieldValue.delete();
      update.archivedAt = FieldValue.delete();
    }

    await animalRef.update(update);
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
// Exclusivo para role admin. Não grava rastreabilidade porque o documento é
// removido e a fase 3.3 não cria auditLog nem writes extras.
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
    secrets: [piiEncryptionKey, hmacSecretKey, ...driveSecrets],
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
      const approvedAt = data.reviewedAt instanceof Timestamp ?
        data.reviewedAt.toDate() :
        (data.updatedAt as Timestamp).toDate();
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
        approvedAt,
        reviewerName: (data.reviewedByLabel as string | undefined) ?? "Equipe Upeva",
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
          await deleteStorageFilesFromUrls(animalData.photos);
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
      const rejectedAt = data.reviewedAt instanceof Timestamp ?
        data.reviewedAt.toDate() :
        (data.updatedAt as Timestamp).toDate();
      const pdfBuffer = await generatePdf("rejection", {
        applicationId: docSnap.id,
        fullName: data.fullName as string,
        email: data.email as string,
        cpf: pii.cpf,
        animalName: data.animalName as string | undefined,
        species: (data.species as string) ?? "dog",
        rejectionReason: data.rejectionReason as string,
        rejectionDetails: data.rejectionDetails as string,
        reviewerName: (data.reviewedByLabel as string | undefined) ?? "Equipe Upeva",
        rejectedAt,
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
        archivedBy: data.archivedByLabel as string | undefined,
        ongName: ONG_NAME,
      });

      const driveUrl = await uploadToDrive(
        pdfBuffer,
        `animal_${docSnap.id}_${year}.pdf`,
        folderId
      );
      await deleteStorageFilesFromUrls(data.photos);
      await docSnap.ref.update({ driveUrl });
      await docSnap.ref.delete();
    }
    // onAnimalChanged e onApplicationStatusChanged mantêm metadata/counts via FieldValue.increment.
    // Não recalibrar aqui — o cron rodar count() antes dos triggers concluírem causaria race condition
    // que deixa os contadores negativos. Use recalibrateCounts() manualmente se houver drift.
  }
);
