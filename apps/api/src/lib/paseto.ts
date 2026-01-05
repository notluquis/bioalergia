import { createHash } from "crypto";
import { V3 } from "paseto";

const SECRET =
  process.env.JWT_SECRET || "default_super_secret_key_at_least_32_bytes_long";

// Ensure key is 32 bytes for V3.local (AES-256-CTR + HMAC-SHA384)
// Helper to derive a 32-byte key from the existing secret
function getKey() {
  const keyBuffer = Buffer.from(SECRET);
  if (keyBuffer.length === 32) return keyBuffer;

  // If not 32 bytes, hash it to sha256 to get exactly 32 bytes
  return createHash("sha256").update(SECRET).digest();
}

const KEY = getKey();

export async function signToken(payload: any, expiresIn: string = "2d") {
  // Using V3.encrypt for local (symmetric) tokens
  // paseto supports 'expiresIn' option directly

  const options = {
    expiresIn,
  };

  return V3.encrypt(payload, KEY, options);
}

export async function verifyToken(token: string) {
  try {
    const payload = await V3.decrypt(token, KEY);

    // The paseto library validates 'exp' automatically
    return payload;
  } catch (error) {
    throw new Error("Invalid token");
  }
}
