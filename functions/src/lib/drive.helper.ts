import { drive, drive_v3 as DriveV3 } from "@googleapis/drive";
import { OAuth2Client } from "google-auth-library";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";

const driveClientId = defineSecret("DRIVE_OAUTH_CLIENT_ID");
const driveClientSecret = defineSecret("DRIVE_OAUTH_CLIENT_SECRET");
const driveRefreshToken = defineSecret("DRIVE_OAUTH_REFRESH_TOKEN");

export const driveSecrets = [driveClientId, driveClientSecret, driveRefreshToken];

// Folder IDs raiz no Google Drive (compartilhados com upeva.adocoes@gmail.com)
export const DRIVE_FOLDERS = {
  contracts: "1gCvhqypgr_fkxBSjH4LiF99uQkeSZulY",
  rejections: "1XYbU0BypXSgxsZ95Ij_2g2icLkH_48Nx",
  archivedAnimals: "15gn7uLxXPgKNi3vpKOXJiN0R3wko4Zz_",
} as const;

export type DriveFolderKey = keyof typeof DRIVE_FOLDERS;

let _driveClient: DriveV3.Drive | undefined;

/**
 * Retorna cliente autenticado do Google Drive usando OAuth2 com refresh token
 * da conta upeva.adocoes@gmail.com armazenado no Secret Manager. O cliente é
 * cacheado por instância da Cloud Function (reutilizado entre invocações quentes).
 * @return {object} Cliente autenticado do Google Drive v3.
 */
export function getDriveClient(): DriveV3.Drive {
  if (_driveClient) return _driveClient;

  const clientId = driveClientId.value();
  const clientSecret = driveClientSecret.value();
  const refreshToken = driveRefreshToken.value();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Drive OAuth credentials não disponíveis no Secret Manager.");
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  _driveClient = drive({ version: "v3", auth: oauth2Client });
  return _driveClient;
}

/**
 * Busca ou cria a subpasta do ano dentro da pasta base informada.
 * Idempotente: duas execuções no mesmo ano retornam o mesmo folder ID,
 * sem criar duplicatas.
 * @param {string} baseFolderId - ID da pasta raiz no Drive.
 * @param {number} year - Ano a ser usado como nome da subpasta.
 * @return {Promise<string>} ID da subpasta do ano.
 */
export async function getYearlyFolderId(baseFolderId: string, year: number): Promise<string> {
  const driveClient = getDriveClient();
  const folderName = String(year);

  const res = await driveClient.files.list({
    q: [
      `'${baseFolderId}' in parents`,
      `name = '${folderName}'`,
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false",
    ].join(" and "),
    fields: "files(id, name)",
    spaces: "drive",
  });

  const existing = res.data.files?.[0];
  if (existing?.id) {
    return existing.id;
  }

  const created = await driveClient.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [baseFolderId],
    },
    fields: "id",
  });

  const newId = created.data.id;
  if (!newId) {
    throw new Error("Falha ao criar subpasta anual no Drive.");
  }

  logger.info("cloud_function_operation_succeeded", {
    operation: "drive.folder.year.create",
    targetId: newId,
    status: /^\d{4}$/.test(folderName) ? folderName : "invalid_year",
    result: "success",
  });
  return newId;
}

/**
 * Faz upload de um Buffer como PDF no Google Drive e retorna a URL de
 * visualização do arquivo. O arquivo fica na conta upeva.adocoes@gmail.com
 * e visível apenas para quem tem acesso à pasta (não é público).
 * @param {Buffer} buffer - Conteúdo do arquivo a enviar.
 * @param {string} fileName - Nome do arquivo no Drive.
 * @param {string} folderId - ID da pasta destino no Drive.
 * @return {Promise<string>} URL de visualização do arquivo enviado.
 */
export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  folderId: string
): Promise<string> {
  const driveClient = getDriveClient();
  const { Readable } = await import("stream");

  const readable = new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    },
  });

  const res = await driveClient.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: readable,
    },
    fields: "id",
  });

  const fileId = res.data.id;
  if (!fileId) {
    throw new Error("Falha ao obter ID do arquivo após upload.");
  }

  const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
  logger.info("cloud_function_operation_succeeded", {
    operation: "drive.file.upload",
    targetId: fileId,
    status: "uploaded",
    result: "success",
  });
  return webViewLink;
}

export { driveClientId, driveClientSecret, driveRefreshToken };
