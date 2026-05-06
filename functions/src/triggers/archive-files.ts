import {
  markEventProcessed,
  onDocumentWritten,
  updateArchiveFilterMetadata,
} from "../lib/shared.js";

// dropdowns without scanning archiveFiles or exposing PDF metadata broadly.
export const onArchiveFileChanged = onDocumentWritten(
  { document: "archiveFiles/{fileId}", region: "southamerica-east1", maxInstances: 5 },
  async (event) => {
    const processed = await markEventProcessed(event.id);
    if (!processed) return;

    const before = event.data?.before.data() as Record<string, unknown> | undefined;
    const after = event.data?.after.data() as Record<string, unknown> | undefined;

    await updateArchiveFilterMetadata(before, after);
  }
);
