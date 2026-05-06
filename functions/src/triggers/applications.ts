import {
  ACTIVE_APPLICATION_STATUSES,
  appendToAnimalQueue,
  ApplicationStatus,
  db,
  FieldValue,
  INACTIVE_APPLICATION_STATUSES,
  markEventProcessed,
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

    // createApplication assigns queuePosition and activeApplicationCount in the
    // same transaction as the application create. Recomputing here can race with
    // another create trigger and write an older count after a newer transaction.
    if (!before && after?.animalId && ACTIVE_APPLICATION_STATUSES.includes(after.status)) {
      return;
    }

    const animalLinkChanged = before?.animalId !== after?.animalId;
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

    if (!after && before?.animalId) {
      await recomputeAnimalState(before.animalId);
      // Recalibrate queue when an active application is deleted (e.g. declined)
      if (ACTIVE_APPLICATION_STATUSES.includes(before.status)) {
        await recalibrateAnimalQueue(before.animalId);
      }
      return;
    }

    if (!after) return;
    if (!animalLinkChanged && !statusChanged) return;

    if (isReentering && after.animalId) {
      if (animalLinkChanged) return;
      await appendToAnimalQueue(after.animalId, event.params.appId);
      return;
    }

    for (const animalId of affectedAnimalIds) {
      await recomputeAnimalState(animalId);
    }

    // ── Recalibrate queue positions when a candidate leaves the active pool ──
    // Re-entry is handled above by appendToAnimalQueue's animal transaction.
    if (isLeaving && after.animalId) {
      await recalibrateAnimalQueue(after.animalId);
    }
  }
);
