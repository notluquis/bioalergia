/**
 * PASETO Token Utilities
 *
 * Uses auto-generated secret from database - no hardcoded values.
 * Secret is lazily initialized on first use.
 */

import { createHash } from "node:crypto";
import { V3 } from "paseto";
import { getOrCreateTokenSecret } from "./token-secret";

// Key is initialized lazily on first token operation
let KEY: Buffer | null = null;

/**
 * Get the encryption key, initializing from DB if needed.
 * Derives a 32-byte key from the secret using SHA-256 if necessary.
 */
async function getKey(): Promise<Buffer> {
  if (KEY) return KEY;

  const secret = await getOrCreateTokenSecret();
  const keyBuffer = Buffer.from(secret, "hex");

  // If already 32 bytes, use directly
  if (keyBuffer.length === 32) {
    KEY = keyBuffer;
    return KEY;
  }

  // Otherwise hash to get exactly 32 bytes
  KEY = createHash("sha256").update(secret).digest();
  return KEY;
}

export async function signToken(payload: Record<string, unknown>, expiresIn: string = "2d") {
  const key = await getKey();
  return V3.encrypt(payload, key, { expiresIn });
}

export async function verifyToken(token: string) {
  try {
    const key = await getKey();
    const payload = await V3.decrypt(token, key);
    return payload;
  } catch {
    throw new Error("Invalid token");
  }
}
