/**
 * Token Secret Management
 *
 * Auto-generates and persists a secure token signing secret in the database.
 * No hardcoded values - the secret is generated on first use and reused thereafter.
 */

import { randomBytes } from "crypto";
import { db } from "@finanzas/db";

const SECRET_KEY = "system.tokenSecret";
let cachedSecret: string | null = null;

/**
 * Get or create the token signing secret.
 * - On first call: generates a 32-byte random secret and stores in DB
 * - On subsequent calls: retrieves from cache or DB
 *
 * @returns Promise<string> - The 32-byte secret as hex string (64 chars)
 */
export async function getOrCreateTokenSecret(): Promise<string> {
  // Return cached value if available
  if (cachedSecret) {
    return cachedSecret;
  }

  // Check environment variable first (for Railway/production overrides)
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.length >= 32) {
    cachedSecret = envSecret;
    return cachedSecret;
  }

  // Try to get from database
  const existing = await db.setting.findFirst({
    where: { key: SECRET_KEY },
  });

  if (existing?.value) {
    cachedSecret = existing.value;
    return cachedSecret;
  }

  // Generate new secret (32 bytes = 64 hex chars)
  const newSecret = randomBytes(32).toString("hex");

  // Store in database
  await db.setting.upsert({
    where: { key: SECRET_KEY },
    update: { value: newSecret },
    create: { key: SECRET_KEY, value: newSecret },
  });

  console.log("🔐 Generated new token signing secret");
  cachedSecret = newSecret;
  return cachedSecret;
}

/**
 * Initialize the token secret at startup.
 * Call this in your server bootstrap to ensure the secret is ready.
 */
export async function initTokenSecret(): Promise<void> {
  await getOrCreateTokenSecret();
}
