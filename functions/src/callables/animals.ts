import {
  AnimalRecord,
  AnimalStatus,
  ApplicationStatus,
  assertAdminRateLimit,
  assertMaxLength,
  db,
  deleteStorageFilesFromUrls,
  FieldValue,
  getActorLabel,
  HttpsError,
  isAnimalStatus,
  ISO_DATE_REGEX,
  logOperationError,
  logOperationStart,
  logOperationSuccess,
  logPermissionDenied,
  onCall,
  publicAnimalInternalFieldDeletes,
  removeFromAnimalSimilarityCaches,
  removeFromFeaturedAnimalsCache,
  safeRole,
  stripInternalTraceability,
} from "../lib/shared.js";

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
      logPermissionDenied("metadata.counts.recalibrate", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can recalibrate counts.");
    }

    await assertAdminRateLimit(request.auth.uid, "metadata.counts.recalibrate");

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
      logPermissionDenied("featured_animals.update", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only admins can update featured animals.");
    }

    await assertAdminRateLimit(request.auth.uid, "featured_animals.update");

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
      logPermissionDenied("animal.archive", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only staff can archive animals.");
    }

    await assertAdminRateLimit(request.auth.uid, "animal.archive");

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

    const targetId = animalId.trim();
    logOperationStart({
      operation: "animal.archive",
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetId,
      status: "archived",
    });

    try {
      const animalRef = db.collection("animals").doc(targetId);
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

      logOperationSuccess({
        operation: "animal.archive",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
        status: "archived",
      });

      return { success: true };
    } catch (err) {
      logOperationError(err, {
        operation: "animal.archive",
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
        status: "archived",
      });
      throw err;
    }
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
      logPermissionDenied("animal.status.update", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only staff can update animal status.");
    }

    await assertAdminRateLimit(request.auth.uid, "animal.status.update");

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
    const targetId = animalId.trim();
    let operation = "animal.status.update";
    try {
      const animalRef = db.collection("animals").doc(targetId);
      const animalSnap = await animalRef.get();
      if (!animalSnap.exists) {
        throw new HttpsError("not-found", "Animal não encontrado.");
      }

      const animal = animalSnap.data() as AnimalRecord;
      operation = animal.status === "archived" ?
        "animal.restore" :
        "animal.status.update";

      if (animal.status === "adopted" && status !== "adopted") {
        throw new HttpsError(
          "failed-precondition",
          "A reversão de uma adoção deve ser feita pela candidatura aprovada, não diretamente pelo animal."
        );
      }

      if (status === "archived") {
        throw new HttpsError(
          "failed-precondition",
          "Use archiveAnimal para arquivar animais com motivo obrigatório."
        );
      }

      logOperationStart({
        operation,
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
        status,
      });

      const update: Record<string, unknown> = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (status === "adopted") {
        const actorLabel = getActorLabel(request.auth);
        update.updatedBy = request.auth.uid;
        if (actorLabel) update.updatedByLabel = actorLabel;
      } else if (status === "available" || status === "under_review") {
        Object.assign(update, publicAnimalInternalFieldDeletes());
      }

      await animalRef.update(update);

      logOperationSuccess({
        operation,
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
        status,
      });

      return { success: true };
    } catch (err) {
      logOperationError(err, {
        operation,
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
        status,
      });
      throw err;
    }
  }
);

// ── deleteAnimal: destructive animal deletion with server-side cleanup ───────
// Direct client deletes are blocked in Firestore rules. This callable preserves
// the product guard that animals with linked applications cannot be deleted.
export const deleteAnimal = onCall(
  { region: "southamerica-east1", maxInstances: 3 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated.");
    }

    const callerRole = request.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "reviewer") {
      logPermissionDenied("animal.delete", request.auth.uid, callerRole);
      throw new HttpsError("permission-denied", "Only staff can delete animals.");
    }

    await assertAdminRateLimit(request.auth.uid, "animal.delete", 20);

    const { animalId } = request.data as { animalId?: unknown };
    const reason = typeof (request.data as { reason?: unknown }).reason === "string" ?
      (request.data as { reason: string }).reason.trim() :
      "";

    if (typeof animalId !== "string" || !animalId.trim()) {
      throw new HttpsError("invalid-argument", "ID do animal inválido.");
    }
    if (!reason) {
      throw new HttpsError("invalid-argument", "Motivo da exclusão obrigatório.");
    }
    assertMaxLength(reason, 1000, "reason");

    const targetId = animalId.trim();
    const operation = "animal.delete";
    logOperationStart({
      operation,
      uid: request.auth.uid,
      actorRole: safeRole(callerRole),
      targetId,
    });

    try {
      const animalRef = db.collection("animals").doc(targetId);
      const animalSnap = await animalRef.get();
      if (!animalSnap.exists) {
        logOperationSuccess({
          operation,
          uid: request.auth.uid,
          actorRole: safeRole(callerRole),
          targetId,
          result: "already_missing",
        });
        return { success: true, result: "already_missing" };
      }

      const linkedApplicationsSnap = await db.collection("applications")
        .where("animalId", "==", targetId)
        .limit(1)
        .get();
      if (!linkedApplicationsSnap.empty) {
        throw new HttpsError(
          "failed-precondition",
          "Este animal possui candidaturas vinculadas e não pode ser excluído."
        );
      }

      const animal = animalSnap.data() as AnimalRecord & { photos?: unknown };
      await animalRef.delete();

      await Promise.all([
        deleteStorageFilesFromUrls(animal.photos),
        removeFromAnimalSimilarityCaches(targetId, { deleteOwn: true }),
        removeFromFeaturedAnimalsCache(targetId),
      ]);

      logOperationSuccess({
        operation,
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
        result: "deleted",
      });

      return { success: true, result: "deleted" };
    } catch (err) {
      logOperationError(err, {
        operation,
        uid: request.auth.uid,
        actorRole: safeRole(callerRole),
        targetId,
      });
      throw err;
    }
  }
);
