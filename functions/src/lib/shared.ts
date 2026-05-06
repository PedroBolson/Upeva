import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import {
  FieldValue,
  FieldPath,
  getFirestore,
  Timestamp,
  type DocumentReference,
  type Transaction,
} from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import * as functionsV1 from "firebase-functions/v1";
import { encrypt, decrypt, hmac, piiEncryptionKey, hmacSecretKey } from "./crypto.util.js";
import { assertAdminRateLimit } from "./rate-limit.util.js";
import { generatePdf, generateAdoptionContractPdfOfficial, type AddressData, type OfficialContractPdfData } from "./pdf.helper.js";
import { uploadArchivePdf, getArchiveSignedUrl } from "./storage-archive.helper.js";

export {
  FieldValue,
  FieldPath,
  Timestamp,
  HttpsError,
  onCall,
  onDocumentWritten,
  onSchedule,
  functionsV1,
  encrypt,
  decrypt,
  hmac,
  piiEncryptionKey,
  hmacSecretKey,
  assertAdminRateLimit,
  generatePdf,
  uploadArchivePdf,
  getArchiveSignedUrl,
};
export type {
  DocumentReference,
};

initializeApp();

export const db = getFirestore();
export const adminAuth = getAuth();
const adminStorage = getStorage();

export type UserRole = "admin" | "reviewer";
export type ApplicationStatus =
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

export const REJECTION_DETAILS_MIN_LENGTH = 100;
export type AnimalStatus = "available" | "under_review" | "adopted" | "archived";
export const PUBLIC_ANIMAL_DETAIL_STATUSES: AnimalStatus[] = ["available", "under_review"];
export const SIMILAR_ANIMAL_ITEM_STATUSES: AnimalStatus[] = ["available"];
type ArchiveFileType = "contract" | "rejection" | "archivedAnimal";
export type PrivacySearchType = "cpf" | "email";
type PrivacyAuditAction =
  | "delete_application"
  | "delete_rejection_flag"
  | "delete_archive_file"
  | "backfill";
export type Species = "dog" | "cat";
export type Sex = "male" | "female";
export type Size = "small" | "medium" | "large";
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

export type ApplicationRecord = {
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

export type AnimalRecord = {
  name?: string;
  species?: Species;
  sex?: Sex;
  size?: Size;
  breed?: string;
  coatColor?: string;
  estimatedAge?: string;
  neutered?: boolean;
  status?: AnimalStatus;
  adoptedApplicationId?: string;
  adoptedAt?: unknown;
  adoptionContractArchiveFileId?: string;
  activeApplicationCount?: number;
};

export const ACTIVE_APPLICATION_STATUSES: ApplicationStatus[] = ["pending", "in_review"];
export const INACTIVE_APPLICATION_STATUSES: ApplicationStatus[] = ["rejected", "withdrawn"];
const ARCHIVE_FILE_TYPES: ArchiveFileType[] = ["contract", "rejection", "archivedAnimal"];
export const PRIVACY_BACKFILL_BATCH_SIZE = 150;

// ── Helpers ───────────────────────────────────────────────────────────────────

type SafeLogValue = string | number | boolean | null | undefined;

type SafeLogContext = {
  operation: string;
  uid?: string;
  actorRole?: string;
  targetId?: string;
  status?: string;
  result?: string;
  errorCode?: string;
  stack?: string;
  [key: string]: SafeLogValue;
};

function safeLogContext(context: SafeLogContext): Record<string, SafeLogValue> {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) =>
      value === null || ["string", "number", "boolean"].includes(typeof value)
    )
  ) as Record<string, SafeLogValue>;
}

export function safeRole(role: unknown): string | undefined {
  return typeof role === "string" ? role : undefined;
}

export function errorCodeOf(err: unknown): string {
  if (err instanceof HttpsError) return err.code;

  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "unknown";
}

export function logOperationStart(context: SafeLogContext): void {
  logger.info("cloud_function_operation_started", safeLogContext({
    ...context,
    result: "started",
  }));
}

export function logOperationSuccess(context: SafeLogContext): void {
  logger.info("cloud_function_operation_succeeded", safeLogContext({
    ...context,
    result: context.result ?? "success",
  }));
}

export function logPermissionDenied(
  operation: string,
  uid: string | undefined,
  actorRole: unknown,
  targetId?: string,
): void {
  logger.warn("cloud_function_permission_denied", safeLogContext({
    operation,
    uid,
    actorRole: safeRole(actorRole),
    targetId,
    result: "permission_denied",
    errorCode: "permission-denied",
  }));
}

export function logOperationError(
  err: unknown,
  context: SafeLogContext,
): void {
  // Retain only call-frame lines — never the first line, which is the error message
  // and could contain decrypted PII from decrypt/JSON.parse failures.
  const rawStack = err instanceof Error ? err.stack : undefined;
  const stack = rawStack
    ?.split("\n")
    .filter((line) => /^\s+at\s/.test(line))
    .join("\n") || undefined;
  logger.error("cloud_function_operation_failed", safeLogContext({
    ...context,
    result: "error",
    errorCode: errorCodeOf(err),
    stack,
  }));
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "reviewer";
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return ["pending", "in_review", "approved", "rejected", "withdrawn", "declined"].includes(
    String(value)
  );
}

export function isAnimalStatus(value: unknown): value is AnimalStatus {
  return ["available", "under_review", "adopted", "archived"].includes(String(value));
}

export function isPublicAnimalDetailStatus(value: unknown): value is AnimalStatus {
  return PUBLIC_ANIMAL_DETAIL_STATUSES.includes(value as AnimalStatus);
}

export function isSimilarAnimalItemStatus(value: unknown): value is AnimalStatus {
  return SIMILAR_ANIMAL_ITEM_STATUSES.includes(value as AnimalStatus);
}

export function isRejectionReason(value: unknown): value is RejectionReason {
  return VALID_REJECTION_REASONS.has(value as RejectionReason);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const PHONE_REGEX = /^\(\d{2}\)\s\d{5}-\d{4}$/;
const CEP_REGEX = /^\d{5}-\d{3}$/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
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
  "adoptedApplicationId",
  "adoptedAt",
  "archiveReason",
  "archiveDetails",
  "archiveDate",
  "archivedAt",
  "archivedBy",
  "archivedByLabel",
  "roleUpdatedBy",
  "roleUpdatedByLabel",
  "roleUpdatedAt",
];

const PUBLIC_ANIMAL_INTERNAL_FIELDS = [
  "adoptedApplicationId",
  "adoptedAt",
  "updatedBy",
  "updatedByLabel",
  "archiveReason",
  "archiveDetails",
  "archiveDate",
  "archivedBy",
  "archivedByLabel",
  "archivedAt",
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

export function normalizeCpfForPrivacy(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || !isValidCPF(digits)) {
    throw new HttpsError("invalid-argument", "CPF inválido.");
  }
  return digits;
}

export function formatCpfDigits(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function normalizeEmailForPrivacy(value: string): string {
  const email = value.trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "E-mail inválido.");
  }
  return email;
}

export function buildPrivacyIndex(cpf: string, email: string): { cpfHash: string; emailHash: string } {
  return {
    cpfHash: hmac(normalizeCpfForPrivacy(cpf)),
    emailHash: hmac(normalizeEmailForPrivacy(email)),
  };
}

export function hasPrivacyIndex(data: Record<string, unknown>): boolean {
  const index = data.privacyIndex;
  return isPlainObject(index) &&
    typeof index.cpfHash === "string" &&
    typeof index.emailHash === "string";
}

export function validatePrivacyReason(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Informe uma justificativa.");
  }

  const reason = value.trim();
  if (reason.length < 10) {
    throw new HttpsError("invalid-argument", "Justificativa deve ter ao menos 10 caracteres.");
  }
  assertMaxLength(reason, 1000, "reason");

  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(reason) || /[@\d]/.test(reason)) {
    throw new HttpsError(
      "invalid-argument",
      "A justificativa não deve conter números, e-mail ou outros identificadores pessoais."
    );
  }

  return reason;
}

export async function writePrivacyAudit(data: {
  action: PrivacyAuditAction;
  actorUid?: string;
  actorRole?: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  result: string;
  errorCode?: string;
}): Promise<void> {
  await db.collection("privacyRequestAudits").add({
    action: data.action,
    actorUid: data.actorUid ?? null,
    actorRole: data.actorRole ?? null,
    targetType: data.targetType,
    targetId: data.targetId ?? null,
    reason: data.reason ?? null,
    result: data.result,
    errorCode: data.errorCode ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export function assertMaxLength(value: string, max: number, field: string): void {
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

export function stripInternalTraceability(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };
  for (const field of INTERNAL_TRACEABILITY_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

type FieldDelete = ReturnType<typeof FieldValue.delete>;

export function publicAnimalInternalFieldDeletes(): Record<string, FieldDelete> {
  return Object.fromEntries(
    PUBLIC_ANIMAL_INTERNAL_FIELDS.map((field) => [field, FieldValue.delete()]),
  );
}

export function getActorLabel(auth: { token?: { name?: unknown; email?: unknown } }): string | undefined {
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

export function validateApplicationInput(rawData: unknown): ValidatedApplicationInput {
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

export async function runTransactionWithRetry<T>(
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

export async function buildAndCacheSimilarAnimals(
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

    const base = db.collection("animals")
      .where("status", "==", SIMILAR_ANIMAL_ITEM_STATUSES[0]);
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
    itemIds: matches
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string"),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

type SimilarityCacheMutation = {
  deleted: number;
  updated: number;
  scanned: number;
  staleItemsRemoved: number;
};

type SimilarityCacheDoc = {
  id: string;
  ref: DocumentReference;
  data(): Record<string, unknown>;
};

function similarityCacheItems(data: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(data.items)) return [];
  return data.items.filter(isPlainObject);
}

function similarityCacheItemIds(items: Record<string, unknown>[]): string[] {
  return items
    .map((item) => item.id)
    .filter((id): id is string => typeof id === "string");
}

function pruneSimilarityItems(
  items: Record<string, unknown>[],
  isItemAllowed: (id: string, item: Record<string, unknown>) => boolean,
): Record<string, unknown>[] {
  return items.filter((item) => {
    const id = item.id;
    return typeof id === "string" && isItemAllowed(id, item);
  });
}

async function commitSimilarityCacheUpdates(
  updates: Array<{ ref: DocumentReference; data: Record<string, unknown> }>,
): Promise<void> {
  for (let i = 0; i < updates.length; i += 450) {
    const batch = db.batch();
    for (const update of updates.slice(i, i + 450)) {
      batch.set(update.ref, update.data, { merge: true });
    }
    await batch.commit();
  }
}

export async function removeFromAnimalSimilarityCaches(
  animalId: string,
  options: { legacyScanLimit?: number; deleteOwn?: boolean } = {},
): Promise<SimilarityCacheMutation> {
  const legacyScanLimit = options.legacyScanLimit ?? 500;
  const deleteOwn = options.deleteOwn ?? true;
  const docsByPath = new Map<string, SimilarityCacheDoc>();
  const refDocsSnap = await db.collection("animalSimilarityCache")
    .where("itemIds", "array-contains", animalId)
    .limit(100)
    .get();

  for (const docSnap of refDocsSnap.docs) docsByPath.set(docSnap.ref.path, docSnap);

  const legacySnap = await db.collection("animalSimilarityCache")
    .limit(legacyScanLimit)
    .get();
  for (const docSnap of legacySnap.docs) docsByPath.set(docSnap.ref.path, docSnap);

  const deletes: DocumentReference[] = [];
  const updates: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
  let staleItemsRemoved = 0;

  for (const docSnap of docsByPath.values()) {
    const data = docSnap.data();
    const items = similarityCacheItems(data);

    if (docSnap.id === animalId && deleteOwn) {
      deletes.push(docSnap.ref);
      staleItemsRemoved += items.length;
      continue;
    }

    const prunedItems = pruneSimilarityItems(items, (id, item) =>
      id !== animalId && isSimilarAnimalItemStatus(item.status)
    );
    const changed = prunedItems.length !== items.length ||
      !Array.isArray(data.itemIds);
    if (!changed) continue;

    staleItemsRemoved += items.length - prunedItems.length;
    updates.push({
      ref: docSnap.ref,
      data: {
        items: prunedItems,
        itemIds: similarityCacheItemIds(prunedItems),
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  for (let i = 0; i < deletes.length; i += 450) {
    const batch = db.batch();
    for (const ref of deletes.slice(i, i + 450)) batch.delete(ref);
    await batch.commit();
  }
  await commitSimilarityCacheUpdates(updates);

  return {
    deleted: deletes.length,
    updated: updates.length,
    scanned: docsByPath.size,
    staleItemsRemoved,
  };
}

async function getAnimalStatusMap(ids: string[]): Promise<Map<string, AnimalStatus | null>> {
  const statuses = new Map<string, AnimalStatus | null>();
  const uniqueIds = [...new Set(ids)];

  for (let i = 0; i < uniqueIds.length; i += 300) {
    const refs = uniqueIds.slice(i, i + 300)
      .map((id) => db.collection("animals").doc(id));
    const snaps = refs.length > 0 ? await db.getAll(...refs) : [];
    for (const snap of snaps) {
      const status = snap.exists ? snap.data()?.status : null;
      statuses.set(snap.id, isAnimalStatus(status) ? status : null);
    }
  }

  return statuses;
}

export async function pruneAnimalSimilarityCache(
  limit = 500,
): Promise<SimilarityCacheMutation> {
  const cacheSnap = await db.collection("animalSimilarityCache").limit(limit).get();
  const docs = cacheSnap.docs as SimilarityCacheDoc[];
  const animalIds = new Set<string>();

  for (const docSnap of docs) {
    animalIds.add(docSnap.id);
    const data = docSnap.data();
    for (const id of similarityCacheItemIds(similarityCacheItems(data))) animalIds.add(id);
    if (Array.isArray(data.itemIds)) {
      for (const id of data.itemIds) {
        if (typeof id === "string") animalIds.add(id);
      }
    }
  }

  const statuses = await getAnimalStatusMap([...animalIds]);
  const deletes: DocumentReference[] = [];
  const updates: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
  let staleItemsRemoved = 0;

  for (const docSnap of docs) {
    const ownerStatus = statuses.get(docSnap.id) ?? null;
    const data = docSnap.data();
    const items = similarityCacheItems(data);

    if (!isPublicAnimalDetailStatus(ownerStatus)) {
      deletes.push(docSnap.ref);
      staleItemsRemoved += items.length;
      continue;
    }

    const prunedItems = pruneSimilarityItems(items, (id) =>
      isSimilarAnimalItemStatus(statuses.get(id) ?? null)
    );
    const prunedItemIds = similarityCacheItemIds(prunedItems);
    const existingItemIds = Array.isArray(data.itemIds) ?
      data.itemIds.filter((id): id is string => typeof id === "string") :
      [];
    const changed = prunedItems.length !== items.length ||
      prunedItemIds.join("\u0000") !== existingItemIds.join("\u0000");
    if (!changed) continue;

    staleItemsRemoved += items.length - prunedItems.length;
    updates.push({
      ref: docSnap.ref,
      data: {
        items: prunedItems,
        itemIds: prunedItemIds,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  for (let i = 0; i < deletes.length; i += 450) {
    const batch = db.batch();
    for (const ref of deletes.slice(i, i + 450)) batch.delete(ref);
    await batch.commit();
  }
  await commitSimilarityCacheUpdates(updates);

  return {
    deleted: deletes.length,
    updated: updates.length,
    scanned: docs.length,
    staleItemsRemoved,
  };
}

export async function removeFromFeaturedAnimalsCache(animalId: string): Promise<void> {
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

export function isGeneralInterestApplication(application: ApplicationRecord): boolean {
  if (!application.animalId) return true;
  if (application.species === "dog") {
    return application.preferredSex !== undefined || application.preferredSize !== undefined;
  }
  return application.jointAdoption !== undefined || application.preferredSex !== undefined;
}

export function animalMatchesGeneralApplication(application: ApplicationRecord, animal: AnimalRecord): boolean {
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

export async function recomputeAnimalState(animalId: string): Promise<void> {
  const animalRef = db.collection("animals").doc(animalId);

  await runTransactionWithRetry(async (tx) => {
    const animalSnap = await tx.get(animalRef);

    if (!animalSnap.exists) return;

    const animal = animalSnap.data() as AnimalRecord;
    // Single query covers all relevant statuses — no extra read needed
    const relevantAppsSnap = await tx.get(
      db
        .collection("applications")
        .where("animalId", "==", animalId)
        .where("status", "in", ["pending", "approved", "in_review", "withdrawn"])
    );

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
      (app) => ACTIVE_APPLICATION_STATUSES.includes(app.status)
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
      tx.update(animalRef, update);
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
      tx.update(animalRef, update);
      return;
    }

    if (inReviewApps.length > 0) {
      tx.update(animalRef, {
        status: "under_review",
        activeApplicationCount,
        ...publicAnimalInternalFieldDeletes(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    tx.update(animalRef, {
      status: animal.status === "archived" ? "archived" : "available",
      activeApplicationCount,
      ...(animal.status === "archived" ? {} : publicAnimalInternalFieldDeletes()),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function recalibrateAnimalQueue(animalId: string): Promise<void> {
  const animalRef = db.collection("animals").doc(animalId);

  await runTransactionWithRetry(async (tx) => {
    const animalSnap = await tx.get(animalRef);
    if (!animalSnap.exists) return;

    const snap = await tx.get(
      db
        .collection("applications")
        .where("animalId", "==", animalId)
        .where("status", "in", ["pending", "in_review"])
    );

    const sorted = snap.docs.slice().sort((a, b) => {
      const ap = (a.data().queuePosition as number | undefined) ?? Number.MAX_SAFE_INTEGER;
      const bp = (b.data().queuePosition as number | undefined) ?? Number.MAX_SAFE_INTEGER;
      return ap - bp;
    });

    sorted.forEach((doc, i) => {
      const queuePosition = i + 1;
      tx.update(doc.ref, { queuePosition, waitlistEntry: queuePosition > 1 });
    });
    tx.update(animalRef, { activeApplicationCount: sorted.length });
  });
}

export async function appendToAnimalQueue(animalId: string, appId: string): Promise<void> {
  const animalRef = db.collection("animals").doc(animalId);
  const appRef = db.collection("applications").doc(appId);

  await runTransactionWithRetry(async (tx) => {
    const animalSnap = await tx.get(animalRef);
    const appSnap = await tx.get(appRef);
    if (!animalSnap.exists || !appSnap.exists) return;

    const animal = animalSnap.data() as AnimalRecord;
    const application = appSnap.data() as ApplicationRecord;
    if (
      application.animalId !== animalId ||
      !ACTIVE_APPLICATION_STATUSES.includes(application.status)
    ) {
      return;
    }

    if (animal.status !== "available" && animal.status !== "under_review") return;

    const activeApplicationCount =
      typeof animal.activeApplicationCount === "number" && animal.activeApplicationCount >= 0 ?
        animal.activeApplicationCount :
        0;
    const queuePosition = activeApplicationCount + 1;
    const waitlistEntry = queuePosition > 1;

    const animalUpdate: Record<string, unknown> = {
      activeApplicationCount: queuePosition,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (application.status === "in_review") {
      Object.assign(animalUpdate, {
        status: "under_review",
        ...publicAnimalInternalFieldDeletes(),
      });
    }

    tx.update(appRef, { queuePosition, waitlistEntry });
    tx.update(animalRef, animalUpdate);
  });
}

// ── Trigger deduplication (Melhoria 10) ───────────────────────────────────────
// Uses doc.create() which is atomic and fails if the document already exists,
// preventing duplicate processing of retried Firestore trigger events.
export async function markEventProcessed(eventId: string): Promise<boolean> {
  const ref = db.collection("_processedEvents").doc(eventId);
  // expiresAt = 2 days from now, above the 24h retry window without retaining
  // operational deduplication docs for a full week.
  const expiresAt = new Timestamp(Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60, 0);
  try {
    await ref.create({ processedAt: FieldValue.serverTimestamp(), expiresAt });
    return true; // First time — safe to proceed
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "already-exists") return false;
    throw err;
  }
}

type ArchiveFilterKey = {
  type: ArchiveFileType;
  year: number;
};

function isArchiveFileType(value: unknown): value is ArchiveFileType {
  return typeof value === "string" &&
    (ARCHIVE_FILE_TYPES as string[]).includes(value);
}

function getArchiveFilterKey(data: Record<string, unknown> | undefined): ArchiveFilterKey | null {
  if (!data) return null;
  if (!isArchiveFileType(data.type)) return null;
  if (!Number.isInteger(data.year) || (data.year as number) <= 0) return null;

  return {
    type: data.type,
    year: data.year as number,
  };
}

function normalizeCountMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, count]) => typeof count === "number" && Number.isFinite(count) && count > 0)
      .map(([year, count]) => [year, count as number])
  );
}

function addArchiveYearCount(counts: Record<string, number>, year: number, delta: 1 | -1): void {
  const key = String(year);
  const next = (counts[key] ?? 0) + delta;
  if (next > 0) {
    counts[key] = next;
  } else {
    delete counts[key];
  }
}

function yearsFromCountMap(counts: Record<string, number>): number[] {
  return Object.keys(counts)
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year) && year > 0)
    .sort((a, b) => b - a);
}

function emptyArchiveTypeYearCounts(): Record<ArchiveFileType, Record<string, number>> {
  return Object.fromEntries(
    ARCHIVE_FILE_TYPES.map((type) => [type, {}])
  ) as Record<ArchiveFileType, Record<string, number>>;
}

function buildArchiveFilterMetadataPayload(
  countsByYear: Record<string, number>,
  countsByTypeYear: Record<ArchiveFileType, Record<string, number>>,
): {
  countsByYear: Record<string, number>;
  countsByTypeYear: Record<ArchiveFileType, Record<string, number>>;
  years: number[];
  yearsByType: Record<ArchiveFileType, number[]>;
} {
  return {
    countsByYear,
    countsByTypeYear,
    years: yearsFromCountMap(countsByYear),
    yearsByType: Object.fromEntries(
      ARCHIVE_FILE_TYPES.map((type) => [type, yearsFromCountMap(countsByTypeYear[type])])
    ) as Record<ArchiveFileType, number[]>,
  };
}

export async function updateArchiveFilterMetadata(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): Promise<void> {
  const beforeKey = getArchiveFilterKey(before);
  const afterKey = getArchiveFilterKey(after);
  if (
    beforeKey?.type === afterKey?.type &&
    beforeKey?.year === afterKey?.year
  ) {
    return;
  }

  const filtersRef = db.collection("metadata").doc("archiveFileFilters");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(filtersRef);
    const current = snap.data() as {
      countsByYear?: unknown;
      countsByTypeYear?: Partial<Record<ArchiveFileType, unknown>>;
    } | undefined;

    const countsByYear = normalizeCountMap(current?.countsByYear);
    const countsByTypeYear = emptyArchiveTypeYearCounts();
    for (const type of ARCHIVE_FILE_TYPES) {
      countsByTypeYear[type] = normalizeCountMap(current?.countsByTypeYear?.[type]);
    }

    if (beforeKey) {
      addArchiveYearCount(countsByYear, beforeKey.year, -1);
      addArchiveYearCount(countsByTypeYear[beforeKey.type], beforeKey.year, -1);
    }

    if (afterKey) {
      addArchiveYearCount(countsByYear, afterKey.year, 1);
      addArchiveYearCount(countsByTypeYear[afterKey.type], afterKey.year, 1);
    }

    tx.set(filtersRef, {
      ...buildArchiveFilterMetadataPayload(countsByYear, countsByTypeYear),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export async function rebuildArchiveFilterMetadata(): Promise<{
  years: number[];
  yearsByType: Record<ArchiveFileType, number[]>;
}> {
  const countsByYear: Record<string, number> = {};
  const countsByTypeYear = emptyArchiveTypeYearCounts();
  const snap = await db.collection("archiveFiles").select("type", "year").get();

  for (const docSnap of snap.docs) {
    const key = getArchiveFilterKey(docSnap.data() as Record<string, unknown>);
    if (!key) continue;
    addArchiveYearCount(countsByYear, key.year, 1);
    addArchiveYearCount(countsByTypeYear[key.type], key.year, 1);
  }

  const payload = buildArchiveFilterMetadataPayload(countsByYear, countsByTypeYear);
  await db.collection("metadata").doc("archiveFileFilters").set({
    ...payload,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    years: payload.years,
    yearsByType: payload.yearsByType,
  };
}

function getStoragePathFromDownloadUrl(url: string): string | null {
  const encodedPath = url.split("/o/")[1]?.split("?")[0];
  return encodedPath ? decodeURIComponent(encodedPath) : null;
}

export async function deleteStorageFilesFromUrls(urls: unknown): Promise<void> {
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

async function deleteStorageFileIfExists(storagePath: string): Promise<void> {
  try {
    await adminStorage.bucket().file(storagePath).delete();
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    if (code === 404 || code === "404") return;
    throw err;
  }
}

async function commitReferenceUpdates(
  updates: Array<{ ref: DocumentReference; data: Record<string, unknown> }>
): Promise<void> {
  for (let i = 0; i < updates.length; i += 450) {
    const batch = db.batch();
    for (const update of updates.slice(i, i + 450)) {
      batch.update(update.ref, update.data);
    }
    await batch.commit();
  }
}

async function removeArchiveFileReferences(
  archiveFileId: string,
  options: { applications?: boolean; animals?: boolean; rejectionFlags?: boolean } = {}
): Promise<void> {
  const updates: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];

  if (options.applications !== false) {
    const applicationsSnap = await db.collection("applications")
      .where("contractArchiveFileId", "==", archiveFileId)
      .get();
    for (const docSnap of applicationsSnap.docs) {
      updates.push({
        ref: docSnap.ref,
        data: {
          contractArchiveFileId: FieldValue.delete(),
          contractGeneratedAt: FieldValue.delete(),
          contractGenerationStatus: FieldValue.delete(),
        },
      });
    }
  }

  if (options.animals !== false) {
    const animalsSnap = await db.collection("animals")
      .where("adoptionContractArchiveFileId", "==", archiveFileId)
      .get();
    for (const docSnap of animalsSnap.docs) {
      updates.push({
        ref: docSnap.ref,
        data: {
          adoptionContractArchiveFileId: FieldValue.delete(),
        },
      });
    }
  }

  if (options.rejectionFlags === true) {
    const flagsSnap = await db.collection("rejectionFlags")
      .where("archiveFileId", "==", archiveFileId)
      .get();
    for (const docSnap of flagsSnap.docs) {
      updates.push({
        ref: docSnap.ref,
        data: {
          archiveFileId: FieldValue.delete(),
        },
      });
    }
  }

  if (updates.length > 0) {
    await commitReferenceUpdates(updates);
  }
}

export async function deleteArchiveFileInternal(
  archiveFileId: string,
  context: {
    operation: string;
    uid?: string;
    targetId?: string;
    expectedType?: string;
    includeRejectionFlags?: boolean;
  }
): Promise<{ result: string }> {
  const archiveRef = db.collection("archiveFiles").doc(archiveFileId);
  const archiveSnap = await archiveRef.get();

  if (!archiveSnap.exists) {
    await removeArchiveFileReferences(archiveFileId, {
      applications: true,
      animals: true,
      rejectionFlags: context.includeRejectionFlags === true,
    });
    logOperationSuccess({
      operation: context.operation,
      uid: context.uid,
      targetId: context.targetId,
      archiveFileId,
      result: "archive_missing_references_cleaned",
    });
    return { result: "archive_missing_references_cleaned" };
  }

  const archiveData = archiveSnap.data() as Record<string, unknown>;
  const archiveType = archiveData.type as string | undefined;
  if (context.expectedType && archiveType !== context.expectedType) {
    await removeArchiveFileReferences(archiveFileId, {
      applications: true,
      animals: true,
      rejectionFlags: false,
    });
    logOperationError(new Error("archiveFiles type mismatch for cleanup"), {
      operation: context.operation,
      uid: context.uid,
      targetId: context.targetId,
      archiveFileId,
      status: "archive_type_mismatch",
    });
    return { result: "type_mismatch_references_cleaned" };
  }

  const storagePath = archiveData.storagePath as string | undefined;
  if (typeof storagePath !== "string" || !storagePath.startsWith("private-pdfs/")) {
    throw new HttpsError("failed-precondition", "Caminho do arquivo arquivado inválido.");
  }

  await deleteStorageFileIfExists(storagePath);
  await archiveRef.delete();
  await removeArchiveFileReferences(archiveFileId, {
    applications: true,
    animals: true,
    rejectionFlags: context.includeRejectionFlags === true,
  });

  logOperationSuccess({
    operation: context.operation,
    uid: context.uid,
    targetId: context.targetId,
    archiveFileId,
    result: "deleted",
  });

  return { result: "deleted" };
}

export function readApplicationPIIForArchive(data: Record<string, unknown>) {
  return {
    cpf: decrypt(data.cpf as string),
    phone: decrypt(data.phone as string),
    birthDate: decrypt(data.birthDate as string),
    address: JSON.parse(decrypt(data.address as string)),
  };
}

export function slugify(text: string, maxLen = 40): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/, "");
}

// ── generateAndStoreAdoptionContract: helper compartilhado ───────────────────
// Gera o Termo de Adoção Responsável imediatamente após aprovação (ou retry).
// Idempotente: retorna o ID existente se o contrato já foi gerado.
// Nunca faz rollback da aprovação se falhar — apenas marca contractGenerationStatus.
export async function generateAndStoreAdoptionContract(
  applicationId: string,
  applicationData: Record<string, unknown>,
  animalData: AnimalRecord,
  reviewerLabel?: string
): Promise<{ archiveFileId: string }> {
  const pii = readApplicationPIIForArchive(applicationData);
  const approvedAt = applicationData.reviewedAt instanceof Timestamp ?
    (applicationData.reviewedAt as Timestamp).toDate() :
    applicationData.updatedAt instanceof Timestamp ?
      (applicationData.updatedAt as Timestamp).toDate() :
      new Date();

  const animalSlug = slugify((animalData.name ?? "animal") as string);
  const dateStr = approvedAt.toISOString().split("T")[0];
  const shortId = applicationId.slice(0, 6);
  const fileName = `contrato_adocao_${animalSlug}_${dateStr}_${shortId}.pdf`;
  const year = approvedAt.getFullYear();

  const pdfData: OfficialContractPdfData = {
    applicationId,
    fullName: applicationData.fullName as string,
    cpf: pii.cpf,
    birthDate: pii.birthDate,
    phone: pii.phone,
    address: pii.address as AddressData,
    animalName: (animalData.name ?? "Animal") as string,
    species: (animalData.species ?? "dog") as string,
    breed: (animalData.breed ?? "Sem raça definida") as string,
    sex: animalData.sex as string | undefined,
    estimatedAge: animalData.estimatedAge as string | undefined,
    coatColor: (animalData.coatColor ?? "") as string,
    size: animalData.size as string | undefined,
    neutered: animalData.neutered as boolean | undefined,
    approvedAt,
    ongName: "Upeva",
  };

  const pdfBuffer = await generateAdoptionContractPdfOfficial(pdfData);

  const { storagePath, sizeBytes } = await uploadArchivePdf(pdfBuffer, {
    type: "contracts",
    fileName,
    year,
  });

  const archiveRef = await db.collection("archiveFiles").add({
    type: "contract",
    storagePath,
    fileName,
    contentType: "application/pdf",
    sizeBytes,
    year,
    applicationId,
    animalId: (applicationData.animalId as string | undefined) ?? null,
    animalName: (animalData.name as string | undefined) ?? null,
    species: (animalData.species as string | undefined) ?? null,
    reviewerLabel: reviewerLabel ?? null,
    createdAt: FieldValue.serverTimestamp(),
    status: "stored",
  });

  return { archiveFileId: archiveRef.id };
}
