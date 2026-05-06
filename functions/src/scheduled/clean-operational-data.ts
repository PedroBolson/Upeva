import {
  db,
  logOperationError,
  logOperationStart,
  logOperationSuccess,
  onSchedule,
  pruneAnimalSimilarityCache,
  Timestamp,
} from "../lib/shared.js";

// ── cleanOperationalData: cron diário às 3h — remove docs TTL residuais ────────
// TTL do Firestore pode ter latência de até 24h. Este cron faz uma segunda
// passagem para garantir deleção de docs que TTL não limpou em tempo hábil.
export const cleanOperationalData = onSchedule(
  { schedule: "0 3 * * *", timeZone: "America/Sao_Paulo", region: "southamerica-east1" },
  async () => {
    const operation = "cleanup.operational_data";
    logOperationStart({ operation });

    try {
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

      // animalSimilarityCache stale docs/items — bounded pass over 500 cache docs.
      const similarityCacheCleanup = await pruneAnimalSimilarityCache(500);

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

      if (opCount > 0) await batch.commit();

      logOperationSuccess({
        operation,
        rateLimitsDeleted: rateLimitsSnap.size,
        processedEventsDeleted: processedEventsSnap.size,
        similarityCacheDeleted: similarityCacheCleanup.deleted,
        similarityCacheUpdated: similarityCacheCleanup.updated,
        staleSimilarityItemsRemoved: similarityCacheCleanup.staleItemsRemoved,
      });
    } catch (err) {
      logOperationError(err, { operation });
      throw err;
    }
  }
);
