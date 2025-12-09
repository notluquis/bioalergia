import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { prisma } from "../prisma.js";
import { logEvent } from "../lib/logger.js";

const RP_NAME = "Finanzas App";
const RP_ID = process.env.RP_ID || "intranet.bioalergia.cl";
const ORIGIN = process.env.ORIGIN || "https://intranet.bioalergia.cl";

/**
 * Generate options for registering a new passkey.
 */
export async function generatePasskeyRegistrationOptions(user: { id: number; email: string }) {
  // Check if user already has a passkey (limit 1 per user)
  // We allow overwriting, so we don't throw error here anymore.
  // The user will be prompted by the browser if they want to create a new one.
  /*
  const existingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passkeyCredentialID: true },
  });

  if (existingUser?.passkeyCredentialID) {
    throw new Error("Usuario ya tiene un Passkey registrado. Elimínalo primero.");
  }
  */

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new Uint8Array(Buffer.from(String(user.id))),
    userName: user.email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required", // Force discoverable credential (Passkey)
      userVerification: "preferred",
      authenticatorAttachment: "platform", // Prefer built-in (TouchID/FaceID)
    },
  });

  // Ensure user.id is a string (base64) for the client
  // The library should return JSON, but we enforce it to be safe against serialization issues
  // We use standard 'base64' because some client-side decoders (like atob) fail with 'base64url' (no padding, -_)
  if (typeof options.user.id !== "string") {
    // @ts-ignore - Handle potential type mismatch if library returns Buffer
    options.user.id = Buffer.from(options.user.id).toString("base64");
  }

  return options;
}

/**
 * Verify the registration response and save the passkey.
 */
export async function verifyPasskeyRegistration(
  userId: number,
  body: RegistrationResponseJSON,
  expectedChallenge: string
) {
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false, // Allow if UV was skipped (since we used 'preferred')
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential } = verification.registrationInfo;
    const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

    // credential.id already comes as base64url string from @simplewebauthn/server
    // DO NOT re-encode it - just use it directly

    await prisma.user.update({
      where: { id: userId },
      data: {
        passkeyCredentialID: credentialID,
        passkeyPublicKey: Buffer.from(credentialPublicKey),
        passkeyCounter: BigInt(counter),
        passkeyTransports: body.response.transports || [],
      },
    });

    logEvent("passkey:registered", { userId });
    return true;
  }

  return false;
}

/**
 * Generate options for authenticating with a passkey.
 */
export async function generatePasskeyLoginOptions() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
    allowCredentials: [], // Allow any discoverable credential (usernameless)
  });

  return options;
}

/**
 * Verify the authentication response.
 */
export async function verifyPasskeyLogin(body: AuthenticationResponseJSON, expectedChallenge: string) {
  const credentialID = body.id;

  // Find user by credential ID (try exact match first, then try with/without padding variants)
  let user = await prisma.user.findFirst({
    where: { passkeyCredentialID: credentialID },
  });

  // If not found and credentialID is base64url, also try with = padding (base64 variant)
  if (!user && credentialID) {
    const credentialIDWithPadding = credentialID.padEnd(
      credentialID.length + ((4 - (credentialID.length % 4)) % 4),
      "="
    );
    user = await prisma.user.findFirst({
      where: { passkeyCredentialID: credentialIDWithPadding },
    });
  }

  if (!user || !user.passkeyPublicKey) {
    throw new Error("Passkey no encontrado");
  }

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false, // Allow if UV was skipped
    credential: {
      id: user.passkeyCredentialID!,
      publicKey: new Uint8Array(user.passkeyPublicKey),
      counter: Number(user.passkeyCounter),
      transports: user.passkeyTransports as unknown as AuthenticatorTransportFuture[],
    },
  });

  if (verification.verified) {
    const { newCounter } = verification.authenticationInfo;

    await prisma.user.update({
      where: { id: user.id },
      data: { passkeyCounter: BigInt(newCounter) },
    });

    logEvent("passkey:login_success", { userId: user.id });
    return user;
  }

  throw new Error("Verificación fallida");
}
