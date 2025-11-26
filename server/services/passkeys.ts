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
  const existingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passkeyCredentialID: true },
  });

  if (existingUser?.passkeyCredentialID) {
    throw new Error("Usuario ya tiene un Passkey registrado. Elimínalo primero.");
  }

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: Buffer.from(String(user.id)).toString("base64url"),
    userName: user.email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform", // Prefer built-in (TouchID/FaceID)
    },
  });

  // Save challenge temporarily (in a real app, use Redis or session)
  // For simplicity here, we'll return it and expect client to send it back signed,
  // but ideally we should store it server-side to prevent replay.
  // We will store it in a temporary cache or just rely on the stateless verification if possible.
  // NOTE: SimpleWebAuthn recommends storing the challenge.
  // Since we don't have a session store for unauthenticated users (for login),
  // we will use a simple in-memory map for this prototype or rely on the stateless verification if possible.
  // However, verifyRegistrationResponse REQUIRES the expectedChallenge.
  // We will store it in the user's record temporarily or use a dedicated table if needed.
  // For now, let's assume we pass it back and forth signed or store it in a cookie.

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
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential } = verification.registrationInfo;
    const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

    await prisma.user.update({
      where: { id: userId },
      data: {
        passkeyCredentialID: Buffer.from(credentialID).toString("base64"),
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
  });

  return options;
}

/**
 * Verify the authentication response.
 */
export async function verifyPasskeyLogin(body: AuthenticationResponseJSON, expectedChallenge: string) {
  const credentialID = body.id;

  // Find user by credential ID
  const user = await prisma.user.findFirst({
    where: { passkeyCredentialID: credentialID },
  });

  if (!user || !user.passkeyPublicKey) {
    throw new Error("Passkey no encontrado");
  }

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
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
