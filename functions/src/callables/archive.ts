import {
  AnimalRecord,
  assertAdminRateLimit,
  db,
  deleteArchiveFileInternal,
  FieldValue,
  generateAndStoreAdoptionContract,
  getActorLabel,
  getArchiveSignedUrl,
  hmacSecretKey,
  HttpsError,
  logOperationError,
  logOperationStart,
  logOperationSuccess,
  logPermissionDenied,
  normalizeApplicationAnimalIds,
  onCall,
  piiEncryptionKey,
  rebuildArchiveFilterMetadata,
  safeRole,
} from "../lib/shared.js";

// ── recalibrateArchiveFileFilters: backfill metadata/archiveFileFilters ───────
// Used when deploying the aggregate filter metadata after archive files already
// exist. It reads only safe archive metadata fields (type/year).
export const recalibrateArchiveFileFilters = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      logPermissionDenied("archive.filter_options.recalibrate", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only staff can recalibrate archive filters.");
    }

    await assertAdminRateLimit(request.auth.uid, "archive.filter_options.recalibrate", 20);

    return rebuildArchiveFilterMetadata();
  }
);

// ── getArchiveFileUrl: gera URL assinada de curta duração para PDF privado ─────
// Apenas admin/reviewer podem chamar. Valida que storagePath começa com
// private-pdfs/ para prevenir acesso arbitrário a outros objetos do bucket.
export const getArchiveFileUrl = onCall(
  { region: "southamerica-east1", maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      logPermissionDenied("archive.signed_url.get", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only staff can access archive files.");
    }

    await assertAdminRateLimit(request.auth.uid, "archive.signed_url.get", 100);

    const { archiveFileId } = request.data as { archiveFileId?: string };
    if (typeof archiveFileId !== "string" || !archiveFileId.trim()) {
      throw new HttpsError("invalid-argument", "archiveFileId inválido.");
    }

    const archiveSnap = await db.collection("archiveFiles").doc(archiveFileId.trim()).get();
    if (!archiveSnap.exists) {
      throw new HttpsError("not-found", "Arquivo de arquivamento não encontrado.");
    }

    const archiveData = archiveSnap.data() as Record<string, unknown>;
    const storagePath = archiveData.storagePath as string | undefined;

    if (typeof storagePath !== "string" || !storagePath.startsWith("private-pdfs/")) {
      logOperationError(new Error("Invalid storagePath in archiveFiles document"), {
        operation: "archive.signed_url.get",
        uid: request.auth.uid,
        targetId: archiveFileId.trim(),
        status: "invalid_path",
      });
      throw new HttpsError("internal", "Caminho do arquivo inválido.");
    }

    let signedUrl: string;
    try {
      signedUrl = await getArchiveSignedUrl(storagePath);
    } catch (err) {
      logOperationError(err, {
        operation: "archive.signed_url.get",
        uid: request.auth.uid,
        targetId: archiveFileId.trim(),
        storagePath,
        status: "sign_failed",
      });
      throw new HttpsError("internal", "Erro ao gerar URL do arquivo.");
    }

    logOperationSuccess({
      operation: "archive.signed_url.get",
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetId: archiveFileId.trim(),
      status: "url_generated",
    });

    return { url: signedUrl };
  }
);

// ── deleteArchiveFile: exclusão manual admin-only de PDF arquivado ──────────────
export const deleteArchiveFile = onCall(
  { region: "southamerica-east1", maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin") {
      logPermissionDenied("archive.file.delete", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can delete archive files.");
    }

    await assertAdminRateLimit(request.auth.uid, "archive.file.delete", 30);

    const { archiveFileId } = request.data as { archiveFileId?: string };
    if (typeof archiveFileId !== "string" || !archiveFileId.trim()) {
      throw new HttpsError("invalid-argument", "archiveFileId inválido.");
    }

    const targetId = archiveFileId.trim();
    logOperationStart({
      operation: "archive.file.delete",
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetId,
    });

    try {
      const { result } = await deleteArchiveFileInternal(targetId, {
        operation: "archive.file.delete",
        uid: request.auth.uid,
        targetId,
        includeRejectionFlags: true,
      });

      return { success: true, result };
    } catch (err) {
      logOperationError(err, {
        operation: "archive.file.delete",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
      });
      throw err;
    }
  }
);

// ── generateAdoptionContractNow: retry manual do termo de adoção ──────────────
// Usado quando a geração automática falhou após aprovação.
// Idempotente: se o contrato já existe retorna o ID sem duplicar.
export const generateAdoptionContractNow = onCall(
  {
    region: "southamerica-east1",
    maxInstances: 5,
    secrets: [piiEncryptionKey, hmacSecretKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      logPermissionDenied("contract.generate.now", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only staff can generate adoption contracts.");
    }

    await assertAdminRateLimit(request.auth.uid, "contract.generate.now", 20);

    const { applicationId } = request.data as { applicationId?: string };
    if (typeof applicationId !== "string" || !applicationId.trim()) {
      throw new HttpsError("invalid-argument", "applicationId inválido.");
    }

    const targetId = applicationId.trim();
    const actorLabel = getActorLabel(request.auth);

    logOperationStart({
      operation: "contract.generate.now",
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetId,
    });

    try {
      const appSnap = await db.collection("applications").doc(targetId).get();
      if (!appSnap.exists) {
        throw new HttpsError("not-found", "Candidatura não encontrada.");
      }

      const appData = appSnap.data() as Record<string, unknown>;
      if (appData.status !== "approved") {
        throw new HttpsError("failed-precondition", "Apenas candidaturas aprovadas podem ter termo gerado.");
      }

      // Idempotência: contrato já existe
      if (typeof appData.contractArchiveFileId === "string" && appData.contractArchiveFileId) {
        const existing = await db.collection("archiveFiles").doc(appData.contractArchiveFileId).get();
        if (existing.exists) {
          logOperationSuccess({
            operation: "contract.generate.now",
            uid: request.auth.uid,
            targetId,
            result: "already_exists",
          });
          return { archiveFileId: appData.contractArchiveFileId, alreadyExists: true };
        }
      }

      const animalIds = normalizeApplicationAnimalIds(appData);
      if (animalIds.length === 0) {
        throw new HttpsError("failed-precondition", "Candidatura aprovada sem animal vinculado.");
      }

      const animalSnaps = await db.getAll(...animalIds.map((animalId) => db.collection("animals").doc(animalId)));
      const animalSnapshots = animalSnaps
        .filter((snap) => snap.exists)
        .map((snap) => ({ id: snap.id, data: snap.data() as AnimalRecord }));
      if (animalSnapshots.length === 0) {
        throw new HttpsError("not-found", "Animal vinculado não encontrado.");
      }

      const { archiveFileId } = await generateAndStoreAdoptionContract(
        targetId,
        appData,
        animalSnapshots,
        actorLabel
      );

      const contractBatch = db.batch();
      contractBatch.update(appSnap.ref, {
        contractArchiveFileId: archiveFileId,
        contractGeneratedAt: FieldValue.serverTimestamp(),
        contractGenerationStatus: "stored",
      });
      for (const animalId of animalIds) {
        contractBatch.update(db.collection("animals").doc(animalId), {
          adoptionContractArchiveFileId: archiveFileId,
        });
      }
      await contractBatch.commit();

      logOperationSuccess({
        operation: "contract.generate.now",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
        archiveFileId,
      });

      return { archiveFileId, alreadyExists: false };
    } catch (err) {
      logOperationError(err, {
        operation: "contract.generate.now",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
      });
      throw err;
    }
  }
);
