import { authenticator } from "otplib";
import qrcode from "qrcode";

import { logEvent } from "../lib/logger.js";

/**
 * Generates a new MFA secret and a QR code data URL for the user to scan.
 * @param email User's email to identify the account in the authenticator app.
 */
export async function generateMfaSecret(email: string) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, "Finanzas App", secret);
  const qrCodeUrl = await qrcode.toDataURL(otpauth);

  logEvent("mfa:generate_secret", { email });

  return {
    secret,
    qrCodeUrl,
  };
}

/**
 * Verifies a TOTP token against a secret.
 * @param token The 6-digit code provided by the user.
 * @param secret The user's stored MFA secret.
 */
export function verifyMfaToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
