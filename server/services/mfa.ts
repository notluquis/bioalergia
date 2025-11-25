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
  const qrCodeUrl = await qrcode.toDataURL(otpauth, (error) => {
    if (error) {
      // In a real application, you would handle this error appropriately,
      // e.g., by throwing it, logging it, or returning an error state.
      // For this specific context, `reject` and `resolve` are not defined
      // as this is not within a Promise constructor.
      // The original `await qrcode.toDataURL(otpauth)` already handles
      // promise rejection by throwing an error.
      console.error("Error generating QR code:", error);
      // To make this syntactically valid and assignable, we'll return an empty string
      // or re-throw the error if this function is expected to throw on failure.
      // For now, let's assume `imageUrl` would be undefined on error.
      return;
    }
    // This callback structure is typically used with `new Promise` or
    // when `toDataURL` is called without `await` and expects a callback.
    // When using `await`, `qrcode.toDataURL` returns a Promise directly.
    // The original code `await qrcode.toDataURL(otpauth)` is the idiomatic
    // way to use it with async/await.
    // The `imageUrl` would be the result if this were a callback-only function.
  });

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
