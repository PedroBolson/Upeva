import {
  AnimalStatus,
  buildAndCacheSimilarAnimals,
  db,
  FieldValue,
  isPublicAnimalDetailStatus,
  isSimilarAnimalItemStatus,
  markEventProcessed,
  removeFromAnimalSimilarityCaches,
  onDocumentWritten,
  removeFromFeaturedAnimalsCache,
  Sex,
  Size,
  Species,
} from "../lib/shared.js";

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

    // Rebuild/remove similar-animals cache when public visibility changes.
    const animalId = event.params.animalId;
    if (after && isPublicAnimalDetailStatus(after.status) && after.species) {
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

    if (!after || !isSimilarAnimalItemStatus(after.status)) {
      await removeFromAnimalSimilarityCaches(animalId, {
        deleteOwn: !after || !isPublicAnimalDetailStatus(after.status),
      });
    }
  }
);

// ── onArchiveFileChanged: maintain safe aggregate filter options ──────────────
// Stores only type/year counts in metadata so the admin UI can build filter
