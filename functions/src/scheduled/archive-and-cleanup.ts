import {
  AnimalRecord,
  db,
  deleteStorageFilesFromUrls,
  FieldValue,
  generateAndStoreAdoptionContract,
  generatePdf,
  hmac,
  hmacSecretKey,
  logOperationError,
  logOperationStart,
  logOperationSuccess,
  normalizeCpfForPrivacy,
  onSchedule,
  piiEncryptionKey,
  readApplicationPIIForArchive,
  slugify,
  Timestamp,
  uploadArchivePdf,
} from "../lib/shared.js";

// ── archiveAndCleanup: cron semanal domingo às 2h — exporta e limpa dados ──────
// Processa em ordem: candidaturas → animais. Cada tipo em lotes de 400.
// PDFs ficam em private-pdfs/** no Firebase Storage (Admin SDK); metadados
// seguros ficam em archiveFiles/{id}. O documento original só é deletado após
// upload + escrita de metadados bem-sucedidos.
export async function runArchiveAndCleanup(): Promise<void> {
  const operation = "storage.archive_cleanup";
  logOperationStart({ operation });

  try {
    const now = Date.now();
    const DAYS_30 = 30 * 24 * 60 * 60 * 1000;
    const ONG_NAME = "Upeva Adoções";
    const year = new Date().getFullYear();

    // ── 1. approved > 30 dias → verificar/gerar contrato → deletar ──────────
    // Geração imediata acontece em updateApplicationReview. O cron só gera
    // se contractArchiveFileId estiver ausente (fallback/recovery).
    // Nunca deleta a candidatura sem ter o contrato arquivado com segurança.
    const approvedCutoff = new Timestamp(Math.floor((now - DAYS_30) / 1000), 0);
    const approvedSnap = await db.collection("applications")
      .where("status", "==", "approved")
      .where("updatedAt", "<=", approvedCutoff)
      .limit(400)
      .get();

    for (const docSnap of approvedSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const animalId = data.animalId as string | undefined;

      let contractArchiveFileId = data.contractArchiveFileId as string | undefined;

      // Verificar se o contrato já está arquivado com segurança
      if (contractArchiveFileId) {
        const existingArchive = await db.collection("archiveFiles").doc(contractArchiveFileId).get();
        if (!existingArchive.exists) {
          // ID registrado mas arquivo ausente — regenerar
          contractArchiveFileId = undefined;
          logOperationError(new Error("contractArchiveFileId aponta para arquivo inexistente"), {
            operation: "storage.archive.contract.verify",
            targetId: docSnap.id,
            status: "archive_file_missing",
          });
        }
      }

      // Gerar contrato se ainda não existir (fallback)
      if (!contractArchiveFileId) {
        try {
          const animalSnap = animalId ?
            await db.collection("animals").doc(animalId).get() :
            null;
          const animalData = (animalSnap?.exists ? animalSnap.data() : {}) as AnimalRecord;
          const { archiveFileId } = await generateAndStoreAdoptionContract(
            docSnap.id,
            data,
            animalData,
            (data.reviewedByLabel as string | undefined)
          );
          contractArchiveFileId = archiveFileId;
          await docSnap.ref.update({
            contractArchiveFileId: archiveFileId,
            contractGeneratedAt: FieldValue.serverTimestamp(),
            contractGenerationStatus: "stored",
          });
          if (animalId && animalSnap?.exists) {
            await db.collection("animals").doc(animalId).update({
              adoptionContractArchiveFileId: archiveFileId,
            });
          }
        } catch (err) {
          logOperationError(err, {
            operation: "storage.archive.contract.fallback",
            targetId: docSnap.id,
            status: "fallback_generation_failed",
          });
          // Não deletar se o contrato não pôde ser gerado; cron tentará novamente
          continue;
        }
      }

      // Contrato existe — pode deletar a candidatura e o animal
      if (animalId) {
        const animalSnap = await db.collection("animals").doc(animalId).get();
        if (animalSnap.exists) {
          const animalData = animalSnap.data() as Record<string, unknown>;
          await deleteStorageFilesFromUrls(animalData.photos);
          await animalSnap.ref.delete();
        }
      }
      await docSnap.ref.delete();
    }

    // ── 2. rejected + pendingExport → PDF rejeição → Storage → archiveFiles → flag → deletar
    const rejectedSnap = await db.collection("applications")
      .where("status", "==", "rejected")
      .where("pendingExport", "==", true)
      .limit(400)
      .get();

    for (const docSnap of rejectedSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      let pii: ReturnType<typeof readApplicationPIIForArchive>;
      try {
        pii = readApplicationPIIForArchive(data);
      } catch {
        logOperationError(new Error("pii_decrypt_failed"), {
          operation: "storage.archive.rejection.pii_decrypt",
          targetId: docSnap.id,
          status: "decrypt_failed",
        });
        continue;
      }
      const rejectedAt = data.reviewedAt instanceof Timestamp ?
        data.reviewedAt.toDate() :
        (data.updatedAt as Timestamp).toDate();
      const fileName = `rejeicao_definitiva_${slugify((data.animalName as string) || "candidatura")}_${rejectedAt.toISOString().split("T")[0]}_${docSnap.id.slice(0, 6)}.pdf`;
      const pdfBuffer = await generatePdf("rejection", {
        applicationId: docSnap.id,
        fullName: data.fullName as string,
        email: data.email as string,
        cpf: pii.cpf,
        animalName: data.animalName as string | undefined,
        species: (data.species as string) ?? "dog",
        rejectionReason: data.rejectionReason as string,
        rejectionDetails: data.rejectionDetails as string,
        reviewerName: (data.reviewedByLabel as string | undefined) ?? "Equipe Upeva",
        rejectedAt,
        ongName: ONG_NAME,
      });

      let archiveFileId: string | null = null;
      try {
        const { storagePath, sizeBytes } = await uploadArchivePdf(pdfBuffer, {
          type: "rejections",
          fileName,
          year,
        });
        const archiveRef = await db.collection("archiveFiles").add({
          type: "rejection",
          storagePath,
          fileName,
          contentType: "application/pdf",
          sizeBytes,
          year,
          applicationId: docSnap.id,
          animalId: (data.animalId as string | undefined) ?? null,
          animalName: (data.animalName as string | undefined) ?? null,
          species: (data.species as string | undefined) ?? null,
          reviewerLabel: (data.reviewedByLabel as string | undefined) ?? null,
          createdAt: FieldValue.serverTimestamp(),
          status: "stored",
        });
        archiveFileId = archiveRef.id;
      } catch (err) {
        logOperationError(err, {
          operation: "storage.archive.rejection.upload",
          targetId: docSnap.id,
          status: "upload_failed",
        });
      }

      if (!archiveFileId) continue;

      const cpfHash = hmac(normalizeCpfForPrivacy(pii.cpf));
      const flagRef = db.collection("rejectionFlags").doc(cpfHash);
      const existingFlag = await flagRef.get();
      if (existingFlag.exists) {
        await flagRef.update({
          rejectionCount: (existingFlag.data()?.rejectionCount ?? 0) + 1,
          rejectedAt: FieldValue.serverTimestamp(),
          reason: data.rejectionReason,
          archiveFileId,
        });
      } else {
        await flagRef.set({
          emailHash: hmac(data.email as string),
          rejectionCount: 1,
          rejectedAt: FieldValue.serverTimestamp(),
          reason: data.rejectionReason,
          archiveFileId,
        });
      }

      await docSnap.ref.delete();
    }

    // ── 3. withdrawn > 30 dias → deletar (sem PDF, sem flag) ────────────────
    const withdrawnCutoff = new Timestamp(Math.floor((now - DAYS_30) / 1000), 0);
    const withdrawnSnap = await db.collection("applications")
      .where("status", "==", "withdrawn")
      .where("updatedAt", "<=", withdrawnCutoff)
      .limit(400)
      .get();

    for (const docSnap of withdrawnSnap.docs) {
      await docSnap.ref.delete();
    }

    // ── 4. archived animals > 30 dias → PDF arquivamento → Storage → archiveFiles → deletar
    const archivedCutoff = new Timestamp(Math.floor((now - DAYS_30) / 1000), 0);
    const archivedAnimalsSnap = await db.collection("animals")
      .where("status", "==", "archived")
      .where("archivedAt", "<=", archivedCutoff)
      .limit(400)
      .get();

    for (const docSnap of archivedAnimalsSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const archiveDate = (data.archiveDate as string) ?? new Date().toISOString().split("T")[0];
      const archivedAt = data.archivedAt instanceof Timestamp ?
        (data.archivedAt as Timestamp).toDate() :
        new Date();
      const fileName = `animal_arquivado_${slugify((data.name as string) || "animal")}_${archiveDate.slice(0, 10)}_${docSnap.id.slice(0, 6)}.pdf`;
      const pdfBuffer = await generatePdf("archivedAnimal", {
        animalId: docSnap.id,
        animalName: (data.name as string) ?? "Animal",
        species: (data.species as string) ?? "dog",
        sex: data.sex as string | undefined,
        size: data.size as string | undefined,
        // Guard: legado sem motivo usa valor padrão
        archiveReason: (data.archiveReason as string) ?? "Não informado (registro legado)",
        archiveDetails: (data.archiveDetails as string) ?? "Arquivado antes da implementação do novo sistema.",
        archiveDate: new Date(archiveDate),
        archivedAt,
        archivedBy: data.archivedByLabel as string | undefined,
        ongName: ONG_NAME,
      });

      let uploaded = false;
      try {
        const { storagePath, sizeBytes } = await uploadArchivePdf(pdfBuffer, {
          type: "archived-animals",
          fileName,
          year,
        });
        await db.collection("archiveFiles").add({
          type: "archivedAnimal",
          storagePath,
          fileName,
          contentType: "application/pdf",
          sizeBytes,
          year,
          animalId: docSnap.id,
          animalName: (data.name as string | undefined) ?? null,
          species: (data.species as string | undefined) ?? null,
          reviewerLabel: (data.archivedByLabel as string | undefined) ?? null,
          createdAt: FieldValue.serverTimestamp(),
          status: "stored",
        });
        uploaded = true;
      } catch (err) {
        logOperationError(err, {
          operation: "storage.archive.animal.upload",
          targetId: docSnap.id,
          status: "upload_failed",
        });
      }

      if (!uploaded) continue;

      await deleteStorageFilesFromUrls(data.photos);
      await docSnap.ref.delete();
    }

    logOperationSuccess({
      operation,
      approvedApplications: approvedSnap.size,
      rejectedApplications: rejectedSnap.size,
      withdrawnApplications: withdrawnSnap.size,
      archivedAnimals: archivedAnimalsSnap.size,
    });
    // onAnimalChanged e onApplicationStatusChanged mantêm metadata/counts via FieldValue.increment.
    // Não recalibrar aqui — o cron rodar count() antes dos triggers concluírem causaria race condition
    // que deixa os contadores negativos. Use recalibrateCounts() manualmente se houver drift.
  } catch (err) {
    logOperationError(err, { operation });
    throw err;
  }
}

export const archiveAndCleanup = onSchedule(
  {
    schedule: "0 2 * * 0",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    secrets: [piiEncryptionKey, hmacSecretKey],
  },
  runArchiveAndCleanup
);
