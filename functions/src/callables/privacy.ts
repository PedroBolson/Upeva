import {
  assertAdminRateLimit,
  buildPrivacyIndex,
  db,
  decrypt,
  deleteArchiveFileInternal,
  errorCodeOf,
  FieldPath,
  FieldValue,
  formatCpfDigits,
  hasPrivacyIndex,
  hmac,
  hmacSecretKey,
  HttpsError,
  logOperationError,
  logOperationStart,
  logOperationSuccess,
  logPermissionDenied,
  normalizeApplicationAnimalIds,
  normalizeCpfForPrivacy,
  normalizeEmailForPrivacy,
  onCall,
  piiEncryptionKey,
  PRIVACY_BACKFILL_BATCH_SIZE,
  PrivacySearchType,
  recalibrateAnimalQueue,
  recomputeAnimalState,
  safeRole,
  validatePrivacyReason,
  writePrivacyAudit,
} from "../lib/shared.js";

function sanitizePrivacyApplication(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    id,
    status: data.status ?? null,
    species: data.species ?? null,
    animalId: data.animalId ?? null,
    animalIds: Array.isArray(data.animalIds) ? data.animalIds : null,
    animalName: data.animalName ?? null,
    animalNames: Array.isArray(data.animalNames) ? data.animalNames : null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    reviewedAt: data.reviewedAt ?? null,
    pendingExport: data.pendingExport ?? false,
    contractArchiveFileId: data.contractArchiveFileId ?? null,
    contractGenerationStatus: data.contractGenerationStatus ?? null,
  };
}

function sanitizePrivacyRejectionFlag(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    flagId: id,
    reason: data.reason ?? null,
    rejectionCount: data.rejectionCount ?? 1,
    rejectedAt: data.rejectedAt ?? null,
    archiveFileId: data.archiveFileId ?? null,
  };
}

function sanitizePrivacyArchiveFile(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    id,
    type: data.type ?? null,
    fileName: data.fileName ?? null,
    year: data.year ?? null,
    applicationId: data.applicationId ?? null,
    animalId: data.animalId ?? null,
    animalName: data.animalName ?? null,
    species: data.species ?? null,
    createdAt: data.createdAt ?? null,
    sizeBytes: data.sizeBytes ?? 0,
    status: data.status ?? null,
  };
}

function buildPrivacyWarnings(
  applications: Array<Record<string, unknown>>,
  archiveFiles: Array<Record<string, unknown>>
): Array<{ code: string; message: string }> {
  const warnings = new Map<string, string>();
  const hasActive = applications.some((app) =>
    app.status === "pending" || app.status === "in_review"
  );
  const hasApproved = applications.some((app) => app.status === "approved");
  const hasContractArchive = archiveFiles.some((file) => file.type === "contract");
  const hasArchive = archiveFiles.length > 0;

  if (hasActive) {
    warnings.set(
      "active_application",
      "Há candidatura ativa. Excluir dados operacionais pode remover a pessoa da fila."
    );
  }
  if (hasApproved) {
    warnings.set(
      "approved_application",
      "Há candidatura aprovada. O contrato arquivado deve ser avaliado separadamente."
    );
  }
  if (hasContractArchive) {
    warnings.set(
      "contract_archive",
      "Há contrato de adoção arquivado. A política informa retenção privada do termo."
    );
  }
  if (hasArchive) {
    warnings.set(
      "archive_contains_pii",
      "Arquivos PDF podem conter dados pessoais dentro do documento."
    );
    warnings.set(
      "archive_permanent",
      "Excluir arquivos é permanente se a candidatura ou animal original já foi removido."
    );
  }

  return [...warnings.entries()].map(([code, message]) => ({ code, message }));
}

async function fetchArchiveFilesForPrivacyPreview(
  applicationIds: string[],
  archiveFileIds: string[]
): Promise<Array<Record<string, unknown>>> {
  const archiveMap = new Map<string, Record<string, unknown>>();
  const cleanApplicationIds = [...new Set(applicationIds.filter(Boolean))];
  const cleanArchiveFileIds = [...new Set(archiveFileIds.filter(Boolean))];

  for (let i = 0; i < cleanApplicationIds.length; i += 10) {
    const chunk = cleanApplicationIds.slice(i, i + 10);
    const snap = await db.collection("archiveFiles")
      .where("applicationId", "in", chunk)
      .get();
    for (const docSnap of snap.docs) {
      archiveMap.set(docSnap.id, sanitizePrivacyArchiveFile(docSnap.id, docSnap.data()));
    }
  }

  await Promise.all(cleanArchiveFileIds.map(async (archiveFileId) => {
    const snap = await db.collection("archiveFiles").doc(archiveFileId).get();
    if (snap.exists) {
      archiveMap.set(snap.id, sanitizePrivacyArchiveFile(snap.id, snap.data() as Record<string, unknown>));
    }
  }));

  return [...archiveMap.values()];
}

async function fetchRejectionFlagsForPrivacyPreview(
  type: PrivacySearchType,
  hash: string,
  legacyCpfHash?: string
): Promise<Array<Record<string, unknown>>> {
  const flags = new Map<string, Record<string, unknown>>();

  if (type === "cpf") {
    const ids = [...new Set([hash, legacyCpfHash].filter((id): id is string => Boolean(id)))];
    await Promise.all(ids.map(async (flagId) => {
      const snap = await db.collection("rejectionFlags").doc(flagId).get();
      if (snap.exists) {
        flags.set(snap.id, sanitizePrivacyRejectionFlag(snap.id, snap.data() as Record<string, unknown>));
      }
    }));
    return [...flags.values()];
  }

  const snap = await db.collection("rejectionFlags")
    .where("emailHash", "==", hash)
    .get();
  for (const docSnap of snap.docs) {
    flags.set(docSnap.id, sanitizePrivacyRejectionFlag(docSnap.id, docSnap.data()));
  }
  return [...flags.values()];
}

export const backfillApplicationPrivacyIndexes = onCall(
  {
    region: "southamerica-east1",
    maxInstances: 2,
    secrets: [piiEncryptionKey, hmacSecretKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      logPermissionDenied("privacy_index.backfill", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can backfill privacy indexes.");
    }

    await assertAdminRateLimit(request.auth.uid, "privacy_index.backfill", 20);

    const operation = "privacy_index.backfill";
    logOperationStart({
      operation,
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
    });

    let scannedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      const stateRef = db.collection("_privacyBackfillState").doc("applicationPrivacyIndexes");
      const stateSnap = await stateRef.get();
      const lastDocId = stateSnap.exists && typeof stateSnap.data()?.lastDocId === "string" ?
        stateSnap.data()?.lastDocId as string :
        undefined;

      let query = db.collection("applications")
        .orderBy(FieldPath.documentId())
        .limit(PRIVACY_BACKFILL_BATCH_SIZE);
      if (lastDocId) {
        query = query.startAfter(lastDocId);
      }

      const snap = await query.get();
      const batch = db.batch();
      let pendingWrites = 0;

      for (const docSnap of snap.docs) {
        scannedCount += 1;
        const data = docSnap.data() as Record<string, unknown>;
        if (hasPrivacyIndex(data)) {
          skippedCount += 1;
          continue;
        }

        try {
          const email = typeof data.email === "string" ? data.email : "";
          const encryptedCpf = typeof data.cpf === "string" ? data.cpf : "";
          if (!email || !encryptedCpf) {
            failedCount += 1;
            continue;
          }

          const cpf = decrypt(encryptedCpf);
          batch.update(docSnap.ref, {
            privacyIndex: buildPrivacyIndex(cpf, email),
          });
          pendingWrites += 1;
          updatedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      if (pendingWrites > 0) {
        await batch.commit();
      }

      const lastScannedId = snap.docs.at(-1)?.id;
      const hasMore = snap.size === PRIVACY_BACKFILL_BATCH_SIZE;
      if (lastScannedId && hasMore) {
        await stateRef.set({
          lastDocId: lastScannedId,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        await stateRef.set({
          lastDocId: FieldValue.delete(),
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      await writePrivacyAudit({
        action: "backfill",
        actorUid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetType: "applications",
        result: "success",
      }).catch(() => undefined);

      logOperationSuccess({
        operation,
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        scannedCount,
        updatedCount,
        skippedCount,
        failedCount,
        hasMore,
      });

      return {
        scannedCount,
        updatedCount,
        skippedCount,
        failedCount,
        hasMore,
      };
    } catch (err) {
      await writePrivacyAudit({
        action: "backfill",
        actorUid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetType: "applications",
        result: "error",
        errorCode: errorCodeOf(err),
      }).catch(() => undefined);
      logOperationError(err, {
        operation,
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
      });
      throw err;
    }
  }
);

export const previewPrivacyRequest = onCall(
  { region: "southamerica-east1", maxInstances: 5, secrets: [hmacSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      logPermissionDenied("privacy_request.preview", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can preview privacy requests.");
    }

    await assertAdminRateLimit(request.auth.uid, "privacy_request.preview", 100);

    const { type, value } = request.data as { type?: PrivacySearchType; value?: unknown };
    if (type !== "cpf" && type !== "email") {
      throw new HttpsError("invalid-argument", "Tipo de busca inválido.");
    }
    if (typeof value !== "string" || !value.trim()) {
      throw new HttpsError("invalid-argument", "Valor de busca inválido.");
    }

    let hash: string;
    let legacyCpfHash: string | undefined;
    if (type === "cpf") {
      const normalizedCpf = normalizeCpfForPrivacy(value);
      hash = hmac(normalizedCpf);
      legacyCpfHash = hmac(formatCpfDigits(normalizedCpf));
    } else {
      hash = hmac(normalizeEmailForPrivacy(value));
    }

    const operation = "privacy_request.preview";
    logOperationStart({
      operation,
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetType: type,
    });

    const applicationField = type === "cpf" ?
      "privacyIndex.cpfHash" :
      "privacyIndex.emailHash";
    const applicationsSnap = await db.collection("applications")
      .where(applicationField, "==", hash)
      .limit(100)
      .get();
    const applications = applicationsSnap.docs.map((docSnap) =>
      sanitizePrivacyApplication(docSnap.id, docSnap.data())
    );

    const rejectionFlags = await fetchRejectionFlagsForPrivacyPreview(type, hash, legacyCpfHash);
    const applicationIds = applications.map((app) => app.id as string);
    const archiveFileIds = [
      ...applications
        .map((app) => app.contractArchiveFileId)
        .filter((id): id is string => typeof id === "string" && Boolean(id)),
      ...rejectionFlags
        .map((flag) => flag.archiveFileId)
        .filter((id): id is string => typeof id === "string" && Boolean(id)),
    ];
    const archiveFiles = await fetchArchiveFilesForPrivacyPreview(applicationIds, archiveFileIds);
    const warnings = buildPrivacyWarnings(applications, archiveFiles);

    logOperationSuccess({
      operation,
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetType: type,
      applicationCount: applications.length,
      rejectionFlagCount: rejectionFlags.length,
      archiveFileCount: archiveFiles.length,
    });

    return {
      applications,
      rejectionFlags,
      archiveFiles,
      warnings,
    };
  }
);

export const deletePrivacyApplicationData = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      logPermissionDenied("privacy_request.application.delete", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can delete application privacy data.");
    }

    await assertAdminRateLimit(request.auth.uid, "privacy_request.application.delete", 30);

    const { applicationId } = request.data as { applicationId?: string };
    const reason = validatePrivacyReason((request.data as { reason?: unknown }).reason);
    if (typeof applicationId !== "string" || !applicationId.trim()) {
      throw new HttpsError("invalid-argument", "ID da candidatura inválido.");
    }

    const targetId = applicationId.trim();
    const operation = "privacy_request.application.delete";
    logOperationStart({ operation, uid: request.auth.uid, actorRole: safeRole(callerRole) });

    try {
      const ref = db.collection("applications").doc(targetId);
      const snap = await ref.get();
      if (!snap.exists) {
        await writePrivacyAudit({
          action: "delete_application",
          actorUid: request.auth.uid,
          actorRole: safeRole(callerRole),
          targetType: "application",
          targetId,
          reason,
          result: "already_missing",
        }).catch(() => undefined);
        return { success: true, result: "already_missing" };
      }

      const application = snap.data() as {
        animalId?: unknown;
        animalIds?: unknown;
        status?: unknown;
        queuePosition?: unknown;
        waitlistEntry?: unknown;
        contractArchiveFileId?: unknown;
      };
      const animalIds = normalizeApplicationAnimalIds(application);
      const status = typeof application.status === "string" ? application.status : undefined;
      const hadQueueState =
        typeof application.queuePosition === "number" ||
        typeof application.waitlistEntry === "boolean";
      const hadContractArchive =
        typeof application.contractArchiveFileId === "string" &&
        Boolean(application.contractArchiveFileId.trim());

      if (status === "approved") {
        throw new HttpsError(
          "failed-precondition",
          "Candidaturas aprovadas não são excluídas por esta rotina: revise a decisão de produto para preservar o vínculo de adoção e o contrato privado."
        );
      }

      await ref.delete();
      for (const animalId of animalIds) {
        await recomputeAnimalState(animalId);
        await recalibrateAnimalQueue(animalId);
      }
      await writePrivacyAudit({
        action: "delete_application",
        actorUid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetType: "application",
        targetId,
        reason,
        result: "deleted",
      }).catch(() => undefined);

      logOperationSuccess({
        operation,
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
        result: "deleted",
        animalRecomputed: animalIds.length > 0,
        hadQueueState,
        hadContractArchive,
      });
      return {
        success: true,
        result: "deleted",
        animalRecomputed: animalIds.length > 0,
      };
    } catch (err) {
      await writePrivacyAudit({
        action: "delete_application",
        actorUid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetType: "application",
        targetId,
        reason,
        result: "error",
        errorCode: errorCodeOf(err),
      }).catch(() => undefined);
      logOperationError(err, { operation, uid: request.auth.uid, actorRole: safeRole(callerRole) });
      throw err;
    }
  }
);

export const deletePrivacyRejectionFlag = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      logPermissionDenied("privacy_request.rejection_flag.delete", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can delete rejection flags.");
    }

    await assertAdminRateLimit(request.auth.uid, "privacy_request.rejection_flag.delete", 30);

    const { flagId } = request.data as { flagId?: string };
    const reason = validatePrivacyReason((request.data as { reason?: unknown }).reason);
    if (typeof flagId !== "string" || !flagId.trim()) {
      throw new HttpsError("invalid-argument", "ID da flag inválido.");
    }

    const targetId = flagId.trim();
    const operation = "privacy_request.rejection_flag.delete";
    logOperationStart({ operation, uid: request.auth.uid, actorRole: safeRole(callerRole) });

    try {
      const ref = db.collection("rejectionFlags").doc(targetId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
      }

      await writePrivacyAudit({
        action: "delete_rejection_flag",
        actorUid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetType: "rejectionFlag",
        targetId,
        reason,
        result: snap.exists ? "deleted" : "already_missing",
      }).catch(() => undefined);

      logOperationSuccess({ operation, uid: request.auth.uid, actorRole: safeRole(callerRole) });
      return { success: true, result: snap.exists ? "deleted" : "already_missing" };
    } catch (err) {
      await writePrivacyAudit({
        action: "delete_rejection_flag",
        actorUid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetType: "rejectionFlag",
        targetId,
        reason,
        result: "error",
        errorCode: errorCodeOf(err),
      }).catch(() => undefined);
      logOperationError(err, { operation, uid: request.auth.uid, actorRole: safeRole(callerRole) });
      throw err;
    }
  }
);

export const deletePrivacyArchiveFile = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      logPermissionDenied("privacy_request.archive_file.delete", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can delete archive files.");
    }

    await assertAdminRateLimit(request.auth.uid, "privacy_request.archive_file.delete", 20);

    const { archiveFileId } = request.data as { archiveFileId?: string };
    const reason = validatePrivacyReason((request.data as { reason?: unknown }).reason);
    if (typeof archiveFileId !== "string" || !archiveFileId.trim()) {
      throw new HttpsError("invalid-argument", "archiveFileId inválido.");
    }

    const targetId = archiveFileId.trim();
    const operation = "privacy_request.archive_file.delete";
    logOperationStart({ operation, uid: request.auth.uid, actorRole: safeRole(callerRole) });

    try {
      const { result } = await deleteArchiveFileInternal(targetId, {
        operation,
        uid: request.auth.uid,
        includeRejectionFlags: true,
      });

      await writePrivacyAudit({
        action: "delete_archive_file",
        actorUid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetType: "archiveFile",
        targetId,
        reason,
        result,
      }).catch(() => undefined);

      return { success: true, result };
    } catch (err) {
      await writePrivacyAudit({
        action: "delete_archive_file",
        actorUid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetType: "archiveFile",
        targetId,
        reason,
        result: "error",
        errorCode: errorCodeOf(err),
      }).catch(() => undefined);
      logOperationError(err, { operation, uid: request.auth.uid, actorRole: safeRole(callerRole) });
      throw err;
    }
  }
);
