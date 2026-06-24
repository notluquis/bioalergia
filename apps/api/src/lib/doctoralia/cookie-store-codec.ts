// Codec único del cookie store de Doctoralia. Centraliza encode/decode para que
// TODOS los lectores (route /api/scraper/doctoralia/cookies + calendar-client del
// backfill) usen la misma lógica → no romper un lector al cambiar el formato.
//
// At-rest: cifrado con lib/secret-cipher (AES-256-GCM, WA_SECRET_KEY; fallback
// plaintext si la key no está). Guardado como { enc: "<string>" } en jsonb
// (base64 → jsonb-safe, esquiva null-bytes de cookies de browser).

import { decryptSecret, encryptSecret } from "../secret-cipher.ts";

export type StoredCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
};

export function encodeStoredCookies(cookies: StoredCookie[]): { enc: string } {
  return { enc: encryptSecret(JSON.stringify(cookies)) };
}

export function decodeStoredCookies(raw: unknown): StoredCookie[] {
  // Legacy: array plano sin cifrar (cookies pegadas a mano antes del cifrado).
  if (Array.isArray(raw)) return raw as StoredCookie[];
  // Nuevo: { enc: "<cipher>" }.
  if (raw && typeof raw === "object" && typeof (raw as { enc?: unknown }).enc === "string") {
    const dec = decryptSecret((raw as { enc: string }).enc);
    if (!dec) return [];
    try {
      const parsed = JSON.parse(dec);
      return Array.isArray(parsed) ? (parsed as StoredCookie[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
