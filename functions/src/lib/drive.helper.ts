import { auth as googleAuthPlus, drive, drive_v3 } from "@googleapis/drive";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";

const driveSecret = defineSecret("DRIVE_SERVICE_ACCOUNT_KEY");

// Folder IDs raiz no Google Drive (compartilhados com upeva.adocoes@gmail.com)
export const DRIVE_FOLDERS = {
  contracts: "1gCvhqypgr_fkxBSjH4LiF99uQkeSZulY",
  rejections: "1XYbU0BypXSgxsZ95Ij_2g2icLkH_48Nx",
  archivedAnimals: "15gn7uLxXPgKNi3vpKOXJiN0R3wko4Zz_",
} as const;

export type DriveFolderKey = keyof typeof DRIVE_FOLDERS;

let _driveClient: drive_v3.Drive | undefined;

/**
 * Retorna cliente autenticado do Google Drive usando a Service Account
 * armazenada no Secret Manager. O cliente é cacheado por instância da
 * Cloud Function (reutilizado entre invocações quentes).
 *
 * Deve ser chamado dentro de funções que declaram `driveSecret` nos seus
 * `secrets: [driveSecret]` — o valor é injetado como env var pelo runtime.
 */
export function getDriveClient(): drive_v3.Drive {
  if (_driveClient) return _driveClient;

  const raw = driveSecret.value();
  if (!raw) {
    throw new Error("DRIVE_SERVICE_ACCOUNT_KEY não está disponível no Secret Manager.");
  }

  let credentials: object;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("DRIVE_SERVICE_ACCOUNT_KEY contém JSON inválido.");
  }

  const authClient = new googleAuthPlus.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  _driveClient = drive({ version: "v3", auth: authClient });
  return _driveClient;
}

/**
 * Busca ou cria a subpasta do ano dentro da pasta base informada.
 * Idempotente: duas execuções no mesmo ano retornam o mesmo folder ID,
 * sem criar duplicatas.
 */
export async function getYearlyFolderId(baseFolderId: string, year: number): Promise<string> {
  const drive = getDriveClient();
  const folderName = String(year);

  const res = await drive.files.list({
    q: [
      `'${baseFolderId}' in parents`,
      `name = '${folderName}'`,
      `mimeType = 'application/vnd.google-apps.folder'`,
      `trashed = false`,
    ].join(" and "),
    fields: "files(id, name)",
    spaces: "drive",
  });

  const existing = res.data.files?.[0];
  if (existing?.id) {
    return existing.id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [baseFolderId],
    },
    fields: "id",
  });

  const newId = created.data.id;
  if (!newId) {
    throw new Error(`Falha ao criar subpasta ${folderName} no Drive.`);
  }

  logger.info("drive: subpasta de ano criada", { year: folderName, folderId: newId });
  return newId;
}

/**
 * Faz upload de um Buffer como PDF no Google Drive e retorna a URL de
 * visualização do arquivo. O arquivo fica visível apenas para quem tem
 * acesso à pasta (não é público).
 */
export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  folderId: string
): Promise<string> {
  const drive = getDriveClient();
  const { Readable } = await import("stream");

  const readable = new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    },
  });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: readable,
    },
    fields: "id, webViewLink",
  });

  const fileId = res.data.id;
  const webViewLink = res.data.webViewLink;

  if (!fileId || !webViewLink) {
    throw new Error(`Falha ao obter ID/URL do arquivo após upload: ${fileName}`);
  }

  logger.info("drive: arquivo enviado", { fileName, fileId });
  return webViewLink;
}

export { driveSecret };
