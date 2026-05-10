import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM at-rest encryption for sensitive secrets stored in the DB
// (Meta WABA system user tokens, app secrets, webhook verify tokens, etc).
//
// Format on disk: `enc:v1:<base64(iv | ciphertext | tag)>`
//   - iv: 12 bytes (GCM standard)
//   - tag: 16 bytes (auth tag)
//
// Plaintext fallback: when WA_SECRET_KEY is unset (local dev) we no-op
// encryption so existing dev DBs keep working. Reads transparently
// detect plaintext (no `enc:v1:` prefix) for forward-compat with values
// written before encryption was introduced.

const VERSION_PREFIX = "enc:v1:";

function loadKey(): Buffer | null {
  const raw = process.env.WA_SECRET_KEY;
  if (!raw) return null;
  // Accept hex (64 chars) or base64 (44 chars w/ padding); both decode to 32 bytes.
  const hexMatch = /^[0-9a-fA-F]{64}$/.test(raw);
  const buf = hexMatch ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "WA_SECRET_KEY must decode to 32 bytes (64 hex chars or 44 base64 chars). Generate with `openssl rand -hex 32`.",
    );
  }
  return buf;
}

let cachedKey: Buffer | null | undefined;
function getKey(): Buffer | null {
  if (cachedKey === undefined) cachedKey = loadKey();
  return cachedKey;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(VERSION_PREFIX);
}

export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  const key = getKey();
  if (!key) return plain; // dev-mode passthrough
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return VERSION_PREFIX + Buffer.concat([iv, ciphertext, tag]).toString("base64");
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!isEncrypted(stored)) return stored; // legacy plaintext value
  const key = getKey();
  if (!key) {
    throw new Error(
      "WA_SECRET_KEY is required to decrypt stored secrets but is not set. Configure the env var or restore the previous key.",
    );
  }
  const buf = Buffer.from(stored.slice(VERSION_PREFIX.length), "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("Encrypted payload too short");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// Re-encrypt a value: useful for migrating legacy plaintext rows in-place
// without changing the value. Returns the same plaintext if no key configured.
export function ensureEncrypted(stored: string | null | undefined): string | null {
  if (!stored) return stored ?? null;
  if (isEncrypted(stored)) return stored;
  const key = getKey();
  if (!key) return stored;
  return encryptSecret(stored);
}
