import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";
import { defineSecret } from "firebase-functions/params";

export const piiEncryptionKey = defineSecret("PII_ENCRYPTION_KEY");
export const hmacSecretKey = defineSecret("HMAC_SECRET_KEY");

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;  // 96-bit IV — recomendado para GCM
const AUTH_TAG_BYTES = 16;

/**
 * Cifra texto com AES-256-GCM (autenticado).
 * Retorna `iv_hex:authTag_hex:ciphertext_hex`.
 * IV aleatório por chamada garante que o mesmo texto produz cifras distintas.
 * A chave é lida do Secret Manager em tempo de execução — nunca em variável de ambiente.
 */
export function encrypt(text: string): string {
  const key = Buffer.from(piiEncryptionKey.value(), "hex");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decifra um ciphertext gerado por encrypt().
 * Lança erro se a GCM authentication tag falhar — detecta adulteração ou chave errada.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de ciphertext inválido.");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = Buffer.from(piiEncryptionKey.value(), "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * HMAC-SHA256 com chave secreta separada.
 * Usado para hashes one-way de CPF e email em rejectionFlags.
 * Diferente de SHA-256 puro, resiste a rainbow tables pois a chave é secreta.
 */
export function hmac(text: string): string {
  return createHmac("sha256", hmacSecretKey.value()).update(text, "utf8").digest("hex");
}
