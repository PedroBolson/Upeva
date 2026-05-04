import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";

export type ArchivePdfType = "contracts" | "rejections" | "archived-animals";

export type UploadArchivePdfOptions = {
  type: ArchivePdfType;
  fileName: string;
  year: number;
};

export type ArchiveUploadResult = {
  storagePath: string;
  sizeBytes: number;
};

export function buildArchivePath(type: ArchivePdfType, year: number, fileName: string): string {
  return `private-pdfs/${type}/${year}/${fileName}`;
}

export async function uploadArchivePdf(
  buffer: Buffer,
  options: UploadArchivePdfOptions
): Promise<ArchiveUploadResult> {
  const storagePath = buildArchivePath(options.type, options.year, options.fileName);
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType: "application/pdf",
      cacheControl: "private, no-store",
    },
  });

  logger.info("cloud_function_operation_succeeded", {
    operation: "storage.archive.upload",
    storagePath,
    sizeBytes: buffer.length,
    result: "success",
  });

  return { storagePath, sizeBytes: buffer.length };
}

export async function getArchiveSignedUrl(storagePath: string): Promise<string> {
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });

  return url;
}
