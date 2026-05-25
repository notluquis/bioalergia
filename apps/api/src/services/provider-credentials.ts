// ProviderCredential service — almacena creds encriptadas para scrapers.
//
// Encryption: AES-256-GCM con clave en env `PROVIDER_CREDENTIAL_KEY` (32 bytes hex).
// Si la var no está, falla loud al primer create/update.

import { db } from "@finanzas/db";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.PROVIDER_CREDENTIAL_KEY;
  if (!raw) {
    throw new Error("PROVIDER_CREDENTIAL_KEY env var missing. Set 32-byte hex string (64 chars).");
  }
  if (raw.length === 64) {
    return Buffer.from(raw, "hex");
  }
  // Fallback: derive from string via scrypt
  return scryptSync(raw, "bioalergia-provider-creds", 32);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv|tag|ciphertext (base64)
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join("|");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, ctB64] = stored.split("|");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Invalid encrypted secret format");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString("utf8");
}

type RawCredential = Awaited<ReturnType<typeof db.providerCredential.findFirstOrThrow>>;

function mapCredential(c: RawCredential) {
  // Nunca devolver `secretEncrypted` al cliente.
  const { secretEncrypted: _, metadata: __, ...safe } = c;
  return safe;
}

export interface CredentialPayload {
  authMethod:
    | "API_KEY"
    | "CLAVE_TRIBUTARIA"
    | "CLAVE_UNICA"
    | "EMAIL_FORWARDING"
    | "NONE_PUBLIC"
    | "OAUTH"
    | "RUT_PASSWORD";
  identifier: string;
  isActive?: boolean;
  label?: null | string;
  notes?: null | string;
  provider: string;
  scope?: "BIOALERGIA" | "PERSONAL";
  secret: string;
}

export async function listProviderCredentials(filters: { provider?: string; scope?: string }) {
  const credentials = await db.providerCredential.findMany({
    orderBy: [{ provider: "asc" }, { label: "asc" }],
    where: {
      ...(filters.provider ? { provider: filters.provider as never } : {}),
      ...(filters.scope ? { scope: filters.scope as never } : {}),
    },
  });
  return credentials.map(mapCredential);
}

export async function createProviderCredential(payload: CredentialPayload) {
  const credential = await db.providerCredential.create({
    data: {
      authMethod: payload.authMethod,
      identifier: payload.identifier,
      isActive: payload.isActive ?? true,
      label: payload.label ?? null,
      notes: payload.notes ?? null,
      provider: payload.provider as never,
      scope: payload.scope ?? "PERSONAL",
      secretEncrypted: encryptSecret(payload.secret),
    },
  });
  return mapCredential(credential);
}

export async function updateProviderCredential(id: number, payload: Partial<CredentialPayload>) {
  const credential = await db.providerCredential.update({
    where: { id },
    data: {
      ...(payload.authMethod && { authMethod: payload.authMethod }),
      ...(payload.identifier && { identifier: payload.identifier }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      ...(payload.label !== undefined && { label: payload.label }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
      ...(payload.provider && { provider: payload.provider as never }),
      ...(payload.scope && { scope: payload.scope }),
      ...(payload.secret && { secretEncrypted: encryptSecret(payload.secret) }),
    },
  });
  return mapCredential(credential);
}

export async function deleteProviderCredential(id: number) {
  await db.providerCredential.delete({ where: { id } });
}

// Para uso interno de scrapers — devuelve el secret descifrado.
export async function getDecryptedSecret(id: number): Promise<null | string> {
  const cred = await db.providerCredential.findFirst({ where: { id } });
  if (!cred) return null;
  return decryptSecret(cred.secretEncrypted);
}

// Test placeholder — los scrapers reales sobreescriben con login real.
export async function testCredential(id: number): Promise<{ message: string; success: boolean }> {
  const cred = await db.providerCredential.findFirst({ where: { id } });
  if (!cred) return { message: "Credential not found", success: false };

  try {
    decryptSecret(cred.secretEncrypted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.providerCredential.update({
      where: { id },
      data: { lastError: msg, lastErrorAt: new Date() },
    });
    return { message: `Decryption failed: ${msg}`, success: false };
  }

  return {
    message: `Provider ${cred.provider}: scraper test no implementado aún. Decryption OK.`,
    success: true,
  };
}
