import {
  ACTIVE_APPLICATION_STATUSES,
  animalMatchesGeneralApplication,
  AnimalRecord,
  ApplicationRecord,
  ApplicationStatus,
  assertAdminRateLimit,
  assertMaxLength,
  buildPrivacyIndex,
  db,
  decrypt,
  deleteArchiveFileInternal,
  DocumentReference,
  encrypt,
  FieldValue,
  formatCpfDigits,
  generateAndStoreAdoptionContract,
  getActorLabel,
  hmac,
  hmacSecretKey,
  HttpsError,
  INACTIVE_APPLICATION_STATUSES,
  isApplicationStatus,
  isGeneralInterestApplication,
  isRejectionReason,
  logOperationError,
  logOperationStart,
  logOperationSuccess,
  logPermissionDenied,
  normalizeCpfForPrivacy,
  onCall,
  piiEncryptionKey,
  REJECTION_DETAILS_MIN_LENGTH,
  runTransactionWithRetry,
  safeRole,
  Timestamp,
  validateApplicationInput,
} from "../lib/shared.js";

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

    let waitlistEntry = false;
    let queuePosition = 0;

    const applicationPayload: Record<string, unknown> = {
      species,
      fullName, email, cep,
      cpf: encrypt(cpf),
      phone: encrypt(phone),
      birthDate: encrypt(birthDate),
      address: encrypt(JSON.stringify(address)),
      privacyIndex: buildPrivacyIndex(cpf, email),
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

    const ref = db.collection("applications").doc();

    if (animalId) {
      const animalRef = db.collection("animals").doc(animalId);
      const assignment = await runTransactionWithRetry(async (tx) => {
        const animalSnap = await tx.get(animalRef);
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

        const resolvedAnimalName = typeof animal.name === "string" ? animal.name.trim() : animalName;
        if (!resolvedAnimalName) {
          throw new HttpsError("failed-precondition", "Não foi possível identificar o animal.");
        }

        const activeApplicationCount =
          typeof animal.activeApplicationCount === "number" && animal.activeApplicationCount >= 0 ?
            animal.activeApplicationCount :
            0;
        const nextQueuePosition = activeApplicationCount + 1;
        const nextWaitlistEntry = nextQueuePosition > 1;

        tx.set(ref, {
          ...applicationPayload,
          animalId,
          animalName: resolvedAnimalName,
          queuePosition: nextQueuePosition,
          waitlistEntry: nextWaitlistEntry,
        });
        tx.update(animalRef, {
          activeApplicationCount: nextQueuePosition,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return {
          queuePosition: nextQueuePosition,
          waitlistEntry: nextWaitlistEntry,
        };
      });

      queuePosition = assignment.queuePosition;
      waitlistEntry = assignment.waitlistEntry;
    } else {
      await ref.set(applicationPayload);
    }

    return { id: ref.id, waitlistEntry, queuePosition };
  }
);

export const updateApplicationReview = onCall(
  {
    region: "southamerica-east1",
    maxInstances: 10,
    secrets: [piiEncryptionKey, hmacSecretKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      logPermissionDenied("application.review.update", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only staff can review applications.");
    }

    await assertAdminRateLimit(request.auth.uid, "application.review.update");

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

    const targetId = id.trim();
    logOperationStart({
      operation: "application.review.update",
      uid: actorUid,
      actorRole: safeRole(callerRole),
      targetId,
      status,
    });

    try {
      const appRef = db.collection("applications").doc(targetId);

      // DECLINED: delete immediately — no PDF, no flag, no further processing
      if (status === "declined") {
        const snap = await appRef.get();
        if (!snap.exists) {
          throw new HttpsError("not-found", "Candidatura não encontrada.");
        }
        const application = snap.data() as ApplicationRecord & Record<string, unknown>;
        const contractArchiveFileId = application.status === "approved" &&
          typeof application.contractArchiveFileId === "string" ?
          application.contractArchiveFileId :
          undefined;
        if (contractArchiveFileId) {
          await deleteArchiveFileInternal(contractArchiveFileId, {
            operation: "contract.archive.delete.approval_reversal",
            uid: actorUid,
            targetId,
            expectedType: "contract",
          });
        }
        await appRef.delete();
        logOperationSuccess({
          operation: "application.review.update",
          uid: actorUid,
          actorRole: safeRole(callerRole),
          targetId,
          status,
        });
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
      let previousStatus: ApplicationStatus | undefined;
      let previousContractArchiveFileId: string | undefined;

      await db.runTransaction(async (transaction) => {
        const appSnap = await transaction.get(appRef);
        if (!appSnap.exists) {
          throw new HttpsError("not-found", "Candidatura não encontrada.");
        }

        const application = appSnap.data() as ApplicationRecord;
        previousStatus = application.status;
        previousContractArchiveFileId = typeof (application as Record<string, unknown>).contractArchiveFileId === "string" ?
          (application as Record<string, unknown>).contractArchiveFileId as string :
          undefined;
        const isGeneralInterest = isGeneralInterestApplication(application);
        const currentAnimalId = application.animalId;
        let nextAnimalId = currentAnimalId;
        let nextAnimalName = application.animalName;
        let linkedAnimal: AnimalRecord | null = null;
        let linkedAnimalRef: DocumentReference | null = null;

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
          linkedAnimalRef = animalRef;
        }

        const targetIsActive = ACTIVE_APPLICATION_STATUSES.includes(status);
        const isReentering =
          INACTIVE_APPLICATION_STATUSES.includes(application.status) && targetIsActive;

        if (isReentering && nextAnimalId && !linkedAnimal) {
          const animalRef = db.collection("animals").doc(nextAnimalId);
          const animalSnap = await transaction.get(animalRef);
          if (!animalSnap.exists) {
            throw new HttpsError("not-found", "Animal não encontrado.");
          }
          linkedAnimal = animalSnap.data() as AnimalRecord;
          linkedAnimalRef = animalRef;
        }

        if (isReentering && nextAnimalId && linkedAnimal) {
          if (linkedAnimal.status !== "available" && linkedAnimal.status !== "under_review") {
            throw new HttpsError(
              "failed-precondition",
              "Só é possível reativar candidaturas de animais disponíveis ou em análise."
            );
          }
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
          linkedAnimal = animal;
          linkedAnimalRef = animalRef;

          if (
            typeof animal.adoptedApplicationId === "string" &&
            animal.adoptedApplicationId !== targetId
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

          const conflictingApproved = approvedSnap.docs.find((doc) => doc.id !== targetId);
          if (conflictingApproved) {
            throw new HttpsError(
              "failed-precondition",
              "Já existe outra candidatura aprovada para este animal."
            );
          }
        }

        // Assign queue position atomically when a general-interest application
        // enters an animal's active queue.
        let newQueuePosition: number | undefined;
        const animalLinkChanged = isGeneralInterest && nextAnimalId && nextAnimalId !== currentAnimalId;
        if (animalLinkChanged && targetIsActive && linkedAnimal && linkedAnimalRef) {
          const activeApplicationCount =
            typeof linkedAnimal.activeApplicationCount === "number" &&
              linkedAnimal.activeApplicationCount >= 0 ?
              linkedAnimal.activeApplicationCount :
              0;
          newQueuePosition = activeApplicationCount + 1;
          transaction.update(linkedAnimalRef, {
            activeApplicationCount: newQueuePosition,
            updatedAt: FieldValue.serverTimestamp(),
          });
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

        if (status === "approved" && nextAnimalId && linkedAnimalRef) {
          const animalUpdate: Record<string, unknown> = {
            status: "adopted",
            adoptedApplicationId: targetId,
            adoptedAt: FieldValue.serverTimestamp(),
            activeApplicationCount: 0,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: actorUid,
          };
          if (actorLabel) animalUpdate.updatedByLabel = actorLabel;
          transaction.update(linkedAnimalRef, animalUpdate);
        }

        resolvedAnimalId = nextAnimalId;
        resolvedAnimalName = nextAnimalName;
        transaction.update(appRef, payload);
      });

      if (previousStatus === "approved" && status !== "approved" && previousContractArchiveFileId) {
        await deleteArchiveFileInternal(previousContractArchiveFileId, {
          operation: "contract.archive.delete.approval_reversal",
          uid: actorUid,
          targetId,
          expectedType: "contract",
        });
      } else if (previousStatus === "approved" && status !== "approved") {
        await appRef.update({
          contractArchiveFileId: FieldValue.delete(),
          contractGeneratedAt: FieldValue.delete(),
          contractGenerationStatus: FieldValue.delete(),
        });
      }

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
        const others = activeSnap.docs.filter((d) => d.id !== targetId);
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

      // Gerar o Termo de Adoção imediatamente após a aprovação.
      // Se falhar, não reverte a aprovação — marca contractGenerationStatus: "failed".
      if (status === "approved" && resolvedAnimalId) {
        try {
          const [appSnap, animalSnap] = await Promise.all([
            db.collection("applications").doc(targetId).get(),
            db.collection("animals").doc(resolvedAnimalId).get(),
          ]);
          const appData = appSnap.data() as Record<string, unknown> | undefined;
          const animalSnapData = animalSnap.data() as AnimalRecord | undefined;
          if (appData && animalSnapData) {
            const { archiveFileId } = await generateAndStoreAdoptionContract(
              targetId,
              appData,
              animalSnapData,
              actorLabel
            );
            const contractBatch = db.batch();
            contractBatch.update(db.collection("applications").doc(targetId), {
              contractArchiveFileId: archiveFileId,
              contractGeneratedAt: FieldValue.serverTimestamp(),
              contractGenerationStatus: "stored",
            });
            contractBatch.update(db.collection("animals").doc(resolvedAnimalId), {
              adoptionContractArchiveFileId: archiveFileId,
            });
            await contractBatch.commit();
            logOperationSuccess({
              operation: "contract.generate",
              targetId,
              archiveFileId,
            });
          }
        } catch (contractErr) {
          logOperationError(contractErr, {
            operation: "contract.generate",
            targetId,
            status: "contract_generation_failed",
          });
          try {
            await db.collection("applications").doc(targetId).update({
              contractGenerationStatus: "failed",
            });
          } catch {
            // best-effort; do not mask the approval success
          }
        }
      }

      logOperationSuccess({
        operation: "application.review.update",
        uid: actorUid,
        actorRole: safeRole(callerRole),
        targetId,
        status,
      });

      return { success: true };
    } catch (err) {
      logOperationError(err, {
        operation: "application.review.update",
        uid: actorUid,
        actorRole: safeRole(callerRole),
        targetId,
        status,
      });
      throw err;
    }
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
      logPermissionDenied("application.queue.recalibrate", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can recalibrate queue positions.");
    }

    await assertAdminRateLimit(request.auth.uid, "application.queue.recalibrate");

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
      logPermissionDenied("application.sensitive_data.read", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only staff can access PII.");
    }

    await assertAdminRateLimit(request.auth.uid, "application.sensitive_data.read", 200);

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
      logPermissionDenied("rejection_flag.check", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only staff can check rejection flags.");
    }

    await assertAdminRateLimit(request.auth.uid, "rejection_flag.check", 200);

    const { applicationId } = request.data as { applicationId?: string };
    if (typeof applicationId !== "string" || !applicationId.trim()) {
      throw new HttpsError("invalid-argument", "ID da candidatura inválido.");
    }

    const targetId = applicationId.trim();
    logOperationStart({
      operation: "rejection_flag.check",
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetId,
    });

    try {
      const appSnap = await db.collection("applications").doc(targetId).get();
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

      if (!rawCpf) {
        logOperationSuccess({
          operation: "rejection_flag.check",
          uid: request.auth.uid,
          actorRole: safeRole(callerRole),
          targetId,
          result: "not_flagged",
        });
        return { flagged: false };
      }

      const normalizedCpf = normalizeCpfForPrivacy(rawCpf);
      const cpfHash = hmac(normalizedCpf);
      let flagSnap = await db.collection("rejectionFlags").doc(cpfHash).get();
      let flagId = cpfHash;

      if (!flagSnap.exists) {
        const legacyCpfHash = hmac(formatCpfDigits(normalizedCpf));
        if (legacyCpfHash !== cpfHash) {
          const legacySnap = await db.collection("rejectionFlags").doc(legacyCpfHash).get();
          if (legacySnap.exists) {
            flagSnap = legacySnap;
            flagId = legacyCpfHash;
          }
        }
      }

      if (!flagSnap.exists) {
        logOperationSuccess({
          operation: "rejection_flag.check",
          uid: request.auth.uid,
          actorRole: safeRole(callerRole),
          targetId,
          result: "not_flagged",
        });
        return { flagged: false };
      }

      const flag = flagSnap.data() as Record<string, unknown>;
      logOperationSuccess({
        operation: "rejection_flag.check",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
        result: "flagged",
      });
      return {
        flagged: true,
        flagId,
        reason: flag.reason ?? null,
        rejectionCount: flag.rejectionCount ?? 1,
        rejectedAt: flag.rejectedAt ?? null,
      };
    } catch (err) {
      logOperationError(err, {
        operation: "rejection_flag.check",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
      });
      throw err;
    }
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
      logPermissionDenied("rejection_flag.delete", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can delete rejection flags.");
    }

    await assertAdminRateLimit(request.auth.uid, "rejection_flag.delete");

    const { flagId } = request.data as { flagId?: string };
    if (typeof flagId !== "string" || !flagId.trim()) {
      throw new HttpsError("invalid-argument", "ID da flag inválido.");
    }

    logOperationStart({
      operation: "rejection_flag.delete",
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
    });

    try {
      const flagRef = db.collection("rejectionFlags").doc(flagId.trim());
      const flagSnap = await flagRef.get();

      if (!flagSnap.exists) {
        throw new HttpsError("not-found", "Flag não encontrada.");
      }

      await flagRef.delete();
      logOperationSuccess({
        operation: "rejection_flag.delete",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
      });
      return { success: true };
    } catch (err) {
      logOperationError(err, {
        operation: "rejection_flag.delete",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
      });
      throw err;
    }
  }
);
