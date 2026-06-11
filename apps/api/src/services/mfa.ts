import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import { NodeCryptoPlugin } from "@otplib/plugin-crypto-node";
import { OTP } from "otplib";
import qrcode from "qrcode";

// Instantiate OTP with plugins (defaults to 'totp' strategy)
const otp = new OTP({
  crypto: new NodeCryptoPlugin(),
  base32: new ScureBase32Plugin(),
  // digits and window are not constructor options in v13 OTP class
});

/**
 * Generates a new MFA secret and a QR code data URL for the user to scan.
 * @param email User's email to identify the account in the authenticator app.
 */
export async function generateMfaSecret(email: string) {
  // Generate secret using the configured plugins
  const secret = otp.generateSecret();

  // Generate URI using generateURI (replaces keyuri)
  const otpauth = otp.generateURI({
    issuer: "Finanzas App",
    label: email,
    secret,
  });

  const qrCodeUrl = await qrcode.toDataURL(otpauth);

  console.log("[MFA] Generated secret for:", email);

  return {
    secret,
    qrCodeUrl,
  };
}

// Anti-replay guard: a TOTP code stays valid for the whole step window
// (±30s tolerance above), so an intercepted code could be replayed within
// ~60-90s. Remember the last accepted code per user and reject reuse.
// In-memory is fine while the api runs single-instance (same assumption as
// lib/login-throttle.ts and the WebAuthn challengeStore).
const REPLAY_WINDOW_MS = 90 * 1000;
const lastAcceptedTotp = new Map<number, { token: string; expires: number }>();

export function isTotpReplay(userId: number, token: string): boolean {
  const entry = lastAcceptedTotp.get(userId);
  if (!entry) return false;
  if (entry.expires < Date.now()) {
    lastAcceptedTotp.delete(userId);
    return false;
  }
  return entry.token === token;
}

export function recordTotpAccepted(userId: number, token: string): void {
  lastAcceptedTotp.set(userId, { token, expires: Date.now() + REPLAY_WINDOW_MS });
  // Opportunistic cleanup so the map can't grow unbounded.
  if (lastAcceptedTotp.size > 1000) {
    const now = Date.now();
    for (const [key, value] of lastAcceptedTotp) {
      if (value.expires < now) lastAcceptedTotp.delete(key);
    }
  }
}

/**
 * Verifies a TOTP token against a secret.
 * @param token The 6-digit code provided by the user.
 * @param secret The user's stored MFA secret.
 */
export async function verifyMfaToken(token: string, secret: string): Promise<boolean> {
  try {
    // Verify using instance with plugins
    // verify() returns Promise<VerifyResult> { valid: boolean, ... }
    const result = await otp.verify({
      token,
      secret,
      epochTolerance: 30, // Allow +/- 30 seconds (1 step)
    });

    return result.valid;
  } catch (error) {
    console.error("[MFA] Verification error:", error);
    return false;
  }
}
