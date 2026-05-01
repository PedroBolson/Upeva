/**
 * Cria 4 candidaturas de teste + 1 animal arquivado no Firestore,
 * com PII cifrado e updatedAt 31 dias atrás para acionar o cron.
 *
 * Uso: node scripts/seed-test-applications.js
 */

const { createCipheriv, createHmac, randomBytes } = require("crypto")
const admin = require("./functions/node_modules/firebase-admin")

// ── Chaves (lidas dos secrets) ────────────────────────────────────────────────
const PII_KEY = "a72b5e4ea2b77b117f609d0677e43a4a8dc3395914ff746910abf0d52c3bc4d5"
const HMAC_KEY = "a7acfee1bf2ccc7418595ae493375673c10f98ca01e91f00b319c9a73d338698"

// ── Cripto ────────────────────────────────────────────────────────────────────
function encrypt(text) {
  const key = Buffer.from(PII_KEY, "hex")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 })
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`
}

function hmac(text) {
  return createHmac("sha256", HMAC_KEY).update(text, "utf8").digest("hex")
}

// ── Firebase ──────────────────────────────────────────────────────────────────
admin.initializeApp({ projectId: "upevapets" })
const db = admin.firestore()
const { Timestamp, FieldValue } = admin.firestore

const DAYS_31_AGO = Timestamp.fromDate(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000))
const NOW = FieldValue.serverTimestamp()

// ── Dados base compartilhados ─────────────────────────────────────────────────
const address = { street: "Rua das Flores", number: "123", neighborhood: "Centro", city: "Flores da Cunha", state: "RS" }

const baseForm = {
  species: "dog",
  housingType: "house_closed_yard",
  adultsCount: 2,
  childrenCount: 0,
  adoptionReason: "Quero um companheiro",
  hoursHomePeoplePerDay: 8,
  scratchBehaviorResponse: "Treino e redireciono",
  escapeResponse: "Reforço cercas e monitoro",
  cannotKeepResponse: "Devolvo à ONG",
  acceptsReturnPolicy: true,
  acceptsCastrationPolicy: true,
  acceptsFollowUp: true,
  acceptsNoResale: true,
  acceptsLiabilityTerms: true,
  acceptsResponsibility: true,
  adminNotes: "",
  createdAt: DAYS_31_AGO,
  updatedAt: DAYS_31_AGO,
}

// ── Candidaturas ──────────────────────────────────────────────────────────────
const applications = [
  {
    id: "test-approved-001",
    fullName: "Ana Teste Aprovada",
    email: "ana.aprovada@teste.com",
    cpf: "921.997.400-21",
    phone: "(54) 99111-0001",
    birthDate: "1990-05-15",
    status: "approved",
    animalId: "test-animal-approved",
    animalName: "Rex",
  },
  {
    id: "test-rejected-001",
    fullName: "Bruno Teste Rejeitado",
    email: "bruno.rejeitado@teste.com",
    cpf: "842.667.367-89",
    phone: "(54) 99111-0002",
    birthDate: "1985-08-22",
    status: "rejected",
    animalId: "test-animal-rejected",
    animalName: "Mia",
    rejectionReason: "inadequate_housing",
    rejectionDetails: "A moradia não possui espaço adequado para o porte do animal solicitado, sem área externa segura.",
    rejectedBy: "admin-test",
    rejectedAt: DAYS_31_AGO,
    pendingExport: true,
  },
  {
    id: "test-declined-001",
    fullName: "Carla Teste Recusada",
    email: "carla.recusada@teste.com",
    cpf: "935.096.302-70",
    phone: "(54) 99111-0003",
    birthDate: "1995-03-10",
    status: "declined",
    animalId: null,
    animalName: null,
  },
  {
    id: "test-withdrawn-001",
    fullName: "Diego Teste Desistiu",
    email: "diego.desistiu@teste.com",
    cpf: "076.386.689-01",
    phone: "(54) 99111-0004",
    birthDate: "1992-11-30",
    status: "withdrawn",
    animalId: null,
    animalName: null,
  },
]

// ── Animal arquivado ──────────────────────────────────────────────────────────
const archivedAnimal = {
  id: "test-archived-animal-001",
  name: "Bolinha",
  species: "cat",
  sex: "female",
  size: "small",
  description: "Gatinha laranja, muito carinhosa.",
  photos: [],
  coverPhotoIndex: 0,
  status: "archived",
  vaccines: ["V4", "Antirrábica"],
  neutered: true,
  archiveReason: "serious_illness",
  archiveDetails: "Diagnóstico de doença renal crônica em estágio avançado. Não resistiu ao tratamento.",
  archiveDate: "2026-03-31",
  archivedAt: DAYS_31_AGO,
  createdAt: DAYS_31_AGO,
  updatedAt: DAYS_31_AGO,
}

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  const batch = db.batch()

  for (const app of applications) {
    const { id, fullName, email, cpf, phone, birthDate, ...rest } = app
    const ref = db.collection("applications").doc(id)
    batch.set(ref, {
      ...baseForm,
      ...rest,
      fullName,
      email,
      cpf: encrypt(cpf),
      phone: encrypt(phone),
      birthDate: encrypt(birthDate),
      address: encrypt(JSON.stringify(address)),
    })
    console.log(`✓ application ${id} (${rest.status})`)
  }

  const animalRef = db.collection("animals").doc(archivedAnimal.id)
  const { id: _id, ...animalData } = archivedAnimal
  batch.set(animalRef, animalData)
  console.log(`✓ animal ${archivedAnimal.id} (archived)`)

  await batch.commit()
  console.log("\n✅ Todos os documentos criados. Dispara o cron no Cloud Scheduler agora.")
}

seed().catch((err) => { console.error(err); process.exit(1) })
