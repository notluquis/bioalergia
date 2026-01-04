import argon2 from "argon2";

// 2026 Standard Configuration for Argon2
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hashes a password using Argon2id (2026 Gold Standard).
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a password against a hash.
 * Legacy Bcrypt support has been removed.
 * Returns an object with `valid` usage and `needsRehash` flag.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  // Standard Argon2 Verification
  try {
    const valid = await argon2.verify(hash, password);
    const needsRehash = await argon2.needsRehash(hash, ARGON2_OPTIONS);
    return { valid, needsRehash };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Argon2 verify error:", error);
    }
    return { valid: false, needsRehash: false };
  }
}
