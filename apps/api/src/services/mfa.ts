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
