import {
  ACTIVE_APPLICATION_STATUSES,
  appendToAnimalQueue,
  ApplicationStatus,
  db,
  FieldValue,
  INACTIVE_APPLICATION_STATUSES,
  markEventProcessed,
  normalizeApplicationAnimalIds,
  onDocumentWritten,
  recalibrateAnimalQueue,
  recomputeAnimalState,
} from "../lib/shared.js";

// ── onApplicationStatusChanged: sync animal status + maintain counts ───────────
// Melhoria 10: deduplicates retried events using event ID.
export const onApplicationStatusChanged = onDocumentWritten(
  { document: "applications/{appId}", region: "southamerica-east1", maxInstances: 5 },
  async (event) => {
    // Skip if this event was already processed (at-least-once delivery guard)
    const processed = await markEventProcessed(event.id);
    if (!processed) return;

    const before = event.data?.before.data() as
      | { status: ApplicationStatus; animalId?: string; animalIds?: string[] }
      | undefined;
    const after = event.data?.after.data() as
      | { status: ApplicationStatus; animalId?: string; animalIds?: string[] }
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

    for (const animalId of normalizeApplicationAnimalIds(before ?? {})) affectedAnimalIds.add(animalId);
    for (const animalId of normalizeApplicationAnimalIds(after ?? {})) affectedAnimalIds.add(animalId);

    // createApplication assigns queuePosition and activeApplicationCount in the
    // same transaction as the application create. Recomputing here can race with
    // another create trigger and write an older count after a newer transaction.
    const afterAnimalIds = normalizeApplicationAnimalIds(after ?? {});
    const beforeAnimalIds = normalizeApplicationAnimalIds(before ?? {});

    if (!before && after && afterAnimalIds.length > 0 && ACTIVE_APPLICATION_STATUSES.includes(after.status)) {
      return;
    }

    const animalLinkChanged = beforeAnimalIds.join("\u0000") !== afterAnimalIds.join("\u0000");
    const statusChanged = before?.status !== after?.status;
    const isLeaving =
      before?.status !== undefined &&
      after?.status !== undefined &&
      ACTIVE_APPLICATION_STATUSES.includes(before.status) &&
      INACTIVE_APPLICATION_STATUSES.includes(after.status);
    const isReentering =
      before?.status !== undefined &&
      after?.status !== undefined &&
      INACTIVE_APPLICATION_STATUSES.includes(before.status) &&
      ACTIVE_APPLICATION_STATUSES.includes(after.status);

    if (!after && before && beforeAnimalIds.length > 0) {
      for (const animalId of beforeAnimalIds) await recomputeAnimalState(animalId);
      // Recalibrate queue when an active application is deleted (e.g. declined)
      if (ACTIVE_APPLICATION_STATUSES.includes(before.status)) {
        for (const animalId of beforeAnimalIds) await recalibrateAnimalQueue(animalId);
      }
      return;
    }

    if (!after) return;
    if (!animalLinkChanged && !statusChanged) return;

    if (isReentering && afterAnimalIds.length > 0) {
      if (animalLinkChanged) return;
      for (const animalId of afterAnimalIds) await appendToAnimalQueue(animalId, event.params.appId);
      return;
    }

    for (const animalId of affectedAnimalIds) {
      await recomputeAnimalState(animalId);
    }

    // ── Recalibrate queue positions when a candidate leaves the active pool ──
    // Re-entry is handled above by appendToAnimalQueue's animal transaction.
    if (isLeaving && afterAnimalIds.length > 0) {
      for (const animalId of afterAnimalIds) await recalibrateAnimalQueue(animalId);
    }
  }
);
