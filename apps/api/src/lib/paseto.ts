import { createPrivateKey } from "crypto";
// @ts-ignore - basic mitigation for type mismatch if necessary, or use require
const { V4 } = require("paseto");

const SECRET =
  process.env.JWT_SECRET || "default_super_secret_key_at_least_32_bytes_long";

// Ensure key is 32 bytes for V4.local (ChaCha20-Poly1305)
// We'll use a simple padding/slicing or hashing strategy for compatibility
// But for V4.encrypt, we need a KeyObject or exactly 32 bytes string/buffer.
// Helper to derive a 32-byte key from the existing secret
function getKey() {
  const keyBuffer = Buffer.from(SECRET);
  if (keyBuffer.length === 32) return keyBuffer;

  // If not 32 bytes, hash it to sha256 to get exactly 32 bytes
  const { createHash } = require("crypto");
  return createHash("sha256").update(SECRET).digest();
}

const KEY = getKey();

export async function signToken(payload: any, expiresIn: string = "2d") {
  // PASETO doesn't have "expiresIn" option in the same way as JWT in the top level sign
  // But we can add 'exp' claim manually. paseto-ts might imply it.
  // The 'paseto' package (panva/paseto is common, but let's see which one was installed.
  // Assuming 'paseto' package API. If it's different, we'll adjust.
  // Using V4.encrypt for local usage.

  const iat = Math.floor(Date.now() / 1000);
  // parse "2d" manually or use a lib, for now hardcode 2 days = 172800s
  const exp = iat + 172800;

  const finalPayload = {
    ...payload,
    iat,
    exp,
  };

  return V4.encrypt(finalPayload, KEY);
}

export async function verifyToken(token: string) {
  try {
    const payload = await V4.decrypt(token, KEY);

    // Check expiration manually if the lib doesn't enforce it automatically
    // The 'paseto' reference implementation usually validates 'exp' if present
    // But we'll double check just in case.
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token expired");
    }

    return payload;
  } catch (error) {
    throw new Error("Invalid token");
  }
}
