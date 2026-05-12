import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM at-rest encryption for sensitive secrets stored in the DB
// (Meta WABA system user tokens, app secrets, webhook verify tokens, etc).
//
// Format on disk:
//   v1: `enc:v1:<base64(iv | ciphertext | tag)>`        (single-key era)
//   v2: `enc:v2:<keyId>:<base64(iv | ciphertext | tag)>` (rotation-aware)
//
// Where:
//   - iv: 12 bytes (GCM standard)
//   - tag: 16 bytes (auth tag)
//   - keyId: first 8 hex chars of SHA-256(key) — opaque fingerprint, lets
//            decrypt() pick the right key during rotation.
//
// Rotation:
//   - WA_SECRET_KEY        = current write key (32 bytes hex/base64)
//   - WA_SECRET_KEYS_OLD   = comma-separated past keys still needed for
//                            decryption while migration job re-encrypts rows
//   New writes always use WA_SECRET_KEY. Reads try the keyId first, then
//   fall back to current key for v1 ciphertexts.
//
// Plaintext fallback: when WA_SECRET_KEY is unset (local dev) we no-op
// encryption so existing dev DBs keep working.

const V1_PREFIX = "enc:v1:";
const V2_PREFIX = "enc:v2:";

type LoadedKey = { id: string; key: Buffer };

function decodeKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("empty key");
  const isHex = /^[0-9a-fA-F]{64}$/.test(trimmed);
  const buf = isHex ? Buffer.from(trimmed, "hex") : Buffer.from(trimmed, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `Each WA secret key must decode to 32 bytes (got ${buf.length} bytes from ${trimmed.length}-char input, hex=${isHex}). Generate with \`openssl rand -hex 32\`.`
    );
  }
  return buf;
}

function fingerprint(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 8);
}

function loadKey(raw: string | undefined): LoadedKey | null {
  if (!raw) return null;
  const key = decodeKey(raw);
  return { id: fingerprint(key), key };
}

function loadOldKeys(raw: string | undefined): LoadedKey[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const key = decodeKey(s);
      return { id: fingerprint(key), key };
    });
}

let cachedCurrent: LoadedKey | null | undefined;
let cachedOld: LoadedKey[] | undefined;

function currentKey(): LoadedKey | null {
  if (cachedCurrent === undefined) cachedCurrent = loadKey(process.env.WA_SECRET_KEY);
  return cachedCurrent;
}

function allKeys(): LoadedKey[] {
  if (cachedOld === undefined) cachedOld = loadOldKeys(process.env.WA_SECRET_KEYS_OLD);
  const cur = currentKey();
  return cur ? [cur, ...cachedOld] : cachedOld;
}

// Test hook: reset cached keys so unit tests can mutate env between cases.
export function _resetSecretCipherKeysForTest(): void {
  cachedCurrent = undefined;
  cachedOld = undefined;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(V1_PREFIX) || value.startsWith(V2_PREFIX);
}

// Returns the key fingerprint used to encrypt the value, or null for legacy
// v1 / plaintext.
export function keyIdOf(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(V2_PREFIX)) return null;
  const rest = value.slice(V2_PREFIX.length);
  const colon = rest.indexOf(":");
  return colon === -1 ? null : rest.slice(0, colon);
}

export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  const k = currentKey();
  if (!k) return plain; // dev-mode passthrough
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k.key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const body = Buffer.concat([iv, ciphertext, tag]).toString("base64");
  return `${V2_PREFIX}${k.id}:${body}`;
}

function decryptWith(key: Buffer, body: Buffer): string {
  if (body.length < 12 + 16 + 1) throw new Error("Encrypted payload too short");
  const iv = body.subarray(0, 12);
  const tag = body.subarray(body.length - 16);
  const ciphertext = body.subarray(12, body.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!isEncrypted(stored)) return stored; // legacy plaintext value

  if (stored.startsWith(V2_PREFIX)) {
    const rest = stored.slice(V2_PREFIX.length);
    const colon = rest.indexOf(":");
    if (colon === -1) throw new Error("Malformed v2 ciphertext");
    const keyId = rest.slice(0, colon);
    const body = Buffer.from(rest.slice(colon + 1), "base64");
    const candidate = allKeys().find((k) => k.id === keyId);
    if (!candidate) {
      throw new Error(
        `WA secret was encrypted with key id ${keyId} but no matching key is configured. Set WA_SECRET_KEYS_OLD or restore the original key.`
      );
    }
    return decryptWith(candidate.key, body);
  }

  // v1 legacy: no key id stored. Try every known key until one authenticates.
  const body = Buffer.from(stored.slice(V1_PREFIX.length), "base64");
  const keys = allKeys();
  if (keys.length === 0) {
    throw new Error("WA_SECRET_KEY is required to decrypt stored secrets but is not set.");
  }
  let lastErr: unknown;
  for (const k of keys) {
    try {
      return decryptWith(k.key, body);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `No configured WA secret key could decrypt v1 ciphertext (${(lastErr as Error)?.message ?? "?"}). Add the original key to WA_SECRET_KEYS_OLD.`
  );
}

// Re-encrypt a value: useful for migrating legacy plaintext rows in-place
// AND for rotating ciphertexts to the current key (drops old keys).
// Returns the same plaintext if no key configured.
export function ensureEncrypted(stored: string | null | undefined): string | null {
  if (!stored) return stored ?? null;
  const k = currentKey();
  if (!k) return stored;
  // Already encrypted with the current key — nothing to do.
  if (keyIdOf(stored) === k.id) return stored;
  // Decrypt with whichever key was used (may be old) then re-encrypt with current.
  const plain = decryptSecret(stored);
  return plain == null ? stored : encryptSecret(plain);
}
