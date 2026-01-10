/**
 * Auth Routes for Hono API
 *
 * Handles login, logout, session, MFA, and passkey authentication
 */

import { Hono } from "hono";
import { reply } from "../utils/reply";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { signToken, verifyToken } from "../lib/paseto";
import { db } from "@finanzas/db";

const COOKIE_NAME = "finanzas_session";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 2, // 2 days
  path: "/",
};

export const authRoutes = new Hono();

// Types
interface AuthSession {
  userId: number;
  email: string;
  roles: string[];
}

async function issueToken(session: AuthSession): Promise<string> {
  return signToken(
    {
      sub: session.userId.toString(),
      email: session.email,
      roles: session.roles,
    },
    "2d"
  );
}

// ============================================================
// LOGIN
// ============================================================

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const { email, password } = body;

  if (!email || !password) {
    return reply(
      c,
      { status: "error", message: "Email y contrase?a requeridos" },
      400
    );
  }

  // Find user with ZenStack
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      person: true,
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user || !user.passwordHash) {
    return reply(
      c,
      { status: "error", message: "Credenciales incorrectas" },
      401
    );
  }

  // Import crypto verification (Argon2)
  const { verifyPassword, hashPassword } = await import("../lib/crypto.js");
  const { valid, needsRehash } = await verifyPassword(
    password,
    user.passwordHash
  );

  if (!valid) {
    return reply(
      c,
      { status: "error", message: "Credenciales incorrectas" },
      401
    );
  }

  // Auto-upgrade legacy bcrypt hashes to Argon2
  if (needsRehash) {
    const newHash = await hashPassword(password);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
  }

  // Check MFA
  if (user.mfaEnabled) {
    return reply(c, { status: "mfa_required", userId: user.id });
  }

  // Build roles array
  const roles = user.roles.map((r) => r.role.name);

  // Issue token and set cookie
  const token = await issueToken({ userId: user.id, email: user.email, roles });
  setCookie(c, COOKIE_NAME, token, COOKIE_OPTIONS);

  const { getAbilityRulesForUser } = await import("../services/authz.js");
  const abilityRules = await getAbilityRulesForUser(user.id);

  return reply(c, {
    status: "ok",
    user: {
      id: user.id,
      email: user.email,
      name: user.person?.names || null,
      roles,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
    },
    abilityRules,
  });
});

// ============================================================
// MFA LOGIN
// ============================================================

authRoutes.post("/login/mfa", async (c) => {
  const body = await c.req.json<{ userId: number; token: string }>();
  const { userId, token: mfaToken } = body;

  if (!userId || !mfaToken) {
    return reply(
      c,
      { status: "error", message: "userId y token requeridos" },
      400
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      person: true,
      roles: { include: { role: true } },
    },
  });

  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    return reply(c, { status: "error", message: "MFA no configurado" }, 400);
  }

  // Verify MFA token
  const { verifyMfaToken } = await import("../services/mfa.js");
  const isValid = verifyMfaToken(mfaToken, user.mfaSecret);

  if (!isValid) {
    return reply(c, { status: "error", message: "C?digo incorrecto" }, 401);
  }

  const roles = user.roles.map((r) => r.role.name);
  const token = await issueToken({ userId: user.id, email: user.email, roles });
  setCookie(c, COOKIE_NAME, token, COOKIE_OPTIONS);

  return reply(c, {
    status: "ok",
    user: {
      id: user.id,
      email: user.email,
      name: user.person?.names || null,
      roles,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
    },
  });
});

// ============================================================
// LOGOUT
// ============================================================

authRoutes.post("/logout", async (c) => {
  deleteCookie(c, COOKIE_NAME);
  return reply(c, { status: "ok" });
});

// ============================================================
// SESSION
// ============================================================

authRoutes.get("/me/session", async (c) => {
  const token = getCookie(c, COOKIE_NAME);

  if (!token) {
    return reply(c, { status: "ok", user: null });
  }

  try {
    const decoded = await verifyToken(token);
    const userId = Number(decoded.sub);

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        person: true,
        roles: { include: { role: true } },
        passkeys: { select: { id: true } },
      },
    });

    if (!user) {
      deleteCookie(c, COOKIE_NAME);
      return reply(c, { status: "ok", user: null });
    }

    // --- Role Governance Logic ---
    const { getAbilityRulesForUser } = await import("../services/authz.js");
    const abilityRules = await getAbilityRulesForUser(user.id);

    return reply(c, {
      status: "ok",
      user: {
        id: user.id,
        email: user.email,
        name: user.person?.names || null,
        roles: user.roles.map((r) => r.role.name),
        status: user.status,
        mfaEnabled: user.mfaEnabled,
        mfaEnforced: user.mfaEnforced,
        hasPasskey: user.passkeys.length > 0,
      },
      abilityRules,
      permissionVersion: 1,
    });
  } catch {
    deleteCookie(c, COOKIE_NAME);
    return reply(c, { status: "ok", user: null });
  }
});

// ============================================================
// MFA SETUP
// ============================================================

authRoutes.post("/mfa/setup", async (c) => {
  // Requires auth - extract from cookie
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  try {
    const decoded = await verifyToken(token);
    const userId = Number(decoded.sub);
    const email = String(decoded.email);

    const { generateMfaSecret } = await import("../services/mfa.js");
    const { secret, qrCodeUrl } = await generateMfaSecret(email);

    await db.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });

    return reply(c, { status: "ok", secret, qrCodeUrl });
  } catch {
    return reply(c, { status: "error", message: "Token inv?lido" }, 401);
  }
});

authRoutes.post("/mfa/enable", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  try {
    const decoded = await verifyToken(token);
    const userId = Number(decoded.sub);

    const body = await c.req.json<{ token: string }>();

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      return reply(
        c,
        { status: "error", message: "MFA setup no iniciado" },
        400
      );
    }

    const { verifyMfaToken } = await import("../services/mfa.js");
    const isValid = verifyMfaToken(body.token, user.mfaSecret);

    if (!isValid) {
      return reply(c, { status: "error", message: "C?digo incorrecto" }, 400);
    }

    await db.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return reply(c, { status: "ok" });
  } catch {
    return reply(c, { status: "error", message: "Token inv?lido" }, 401);
  }
});

authRoutes.post("/mfa/disable", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  try {
    const decoded = await verifyToken(token);
    const userId = Number(decoded.sub);

    await db.user.update({
      where: { id: userId },
      data: { mfaSecret: null, mfaEnabled: false },
    });

    return reply(c, { status: "ok" });
  } catch {
    return reply(c, { status: "error", message: "Token inv?lido" }, 401);
  }
});

// ============================================================
// PASSKEY AUTHENTICATION
// ============================================================

// WebAuthn configuration
const RP_NAME = process.env.RP_NAME || "Finanzas App";
const RP_ID = process.env.RP_ID || "intranet.bioalergia.cl";
const ORIGIN = process.env.ORIGIN || "https://intranet.bioalergia.cl";

// In-memory challenge store (for simplicity - should use Redis in production)
const challengeStore = new Map<
  string,
  { challenge: string; userId?: number; expires: number }
>();

function storeChallenge(key: string, challenge: string, userId?: number): void {
  challengeStore.set(key, {
    challenge,
    userId,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}

function getChallenge(
  key: string
): { challenge: string; userId?: number } | null {
  const entry = challengeStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    challengeStore.delete(key);
    return null;
  }
  challengeStore.delete(key); // One-time use
  return { challenge: entry.challenge, userId: entry.userId };
}

// PASSKEY LOGIN OPTIONS
authRoutes.get("/passkey/login/options", async (c) => {
  try {
    const { generateAuthenticationOptions } =
      await import("@simplewebauthn/server");

    // Use empty allowCredentials for discoverable (usernameless) login
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "preferred",
      allowCredentials: [], // Allow any discoverable credential (usernameless)
    });

    // Store challenge for verification
    storeChallenge(`login:${options.challenge}`, options.challenge);

    return reply(c, options);
  } catch (error) {
    console.error("[passkey] login options error:", error);
    return reply(
      c,
      { status: "error", message: "Error generando opciones" },
      500
    );
  }
});

// PASSKEY LOGIN VERIFY
authRoutes.post("/passkey/login/verify", async (c) => {
  try {
    const { verifyAuthenticationResponse } =
      await import("@simplewebauthn/server");
    const body = await c.req.json();
    const { body: authResponse, challenge } = body;

    if (!authResponse || !challenge) {
      return reply(c, { status: "error", message: "Datos incompletos" }, 400);
    }

    // Verify challenge exists
    const storedChallenge = getChallenge(`login:${challenge}`);
    if (!storedChallenge) {
      return reply(
        c,
        { status: "error", message: "Challenge inv?lido o expirado" },
        400
      );
    }

    // Find passkey by credential ID
    const credentialID = authResponse.id;
    const passkey = await db.passkey.findUnique({
      where: { credentialId: credentialID },
      include: {
        user: {
          include: {
            person: true,
            roles: { include: { role: true } },
          },
        },
      },
    });

    if (!passkey || !passkey.user) {
      return reply(
        c,
        { status: "error", message: "Credencial no encontrada" },
        401
      );
    }
    const user = passkey.user;

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports:
          (passkey.transports as AuthenticatorTransportFuture[] | null) ||
          undefined,
      },
    });

    if (!verification.verified) {
      return reply(
        c,
        { status: "error", message: "Verificaci?n fallida" },
        401
      );
    }

    // Update counter
    await db.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    // Issue session token
    const roles = user.roles.map((r) => r.role.name);
    const token = await issueToken({
      userId: user.id,
      email: user.email,
      roles,
    });
    setCookie(c, COOKIE_NAME, token, COOKIE_OPTIONS);

    return reply(c, {
      status: "ok",
      user: {
        id: user.id,
        email: user.email,
        name: user.person?.names || null,
        roles,
        status: user.status,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    console.error("[passkey] login verify error:", error);
    return reply(c, { status: "error", message: "Error de verificaci?n" }, 500);
  }
});

// PASSKEY REGISTER OPTIONS
authRoutes.get("/passkey/register/options", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  try {
    const { generateRegistrationOptions } =
      await import("@simplewebauthn/server");
    const decoded = await verifyToken(token);
    const userId = Number(decoded.sub);
    const email = String(decoded.email);

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { person: true },
    });

    if (!user) {
      return reply(
        c,
        { status: "error", message: "Usuario no encontrado" },
        404
      );
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(String(userId))),
      userName: email,
      userDisplayName: user.person?.names || email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required", // Force discoverable credential (Passkey)
        userVerification: "preferred",
        authenticatorAttachment: "platform", // Prefer built-in (TouchID/FaceID)
      },
      // Allow overwriting - don't exclude existing credentials
    });

    // Store challenge
    storeChallenge(`register:${options.challenge}`, options.challenge, userId);

    return reply(c, options);
  } catch (error) {
    console.error("[passkey] register options error:", error);
    return reply(
      c,
      { status: "error", message: "Error generando opciones" },
      500
    );
  }
});

// PASSKEY REGISTER VERIFY
authRoutes.post("/passkey/register/verify", async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  if (!sessionToken) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  try {
    const { verifyRegistrationResponse } =
      await import("@simplewebauthn/server");
    const decoded = await verifyToken(sessionToken);
    const userId = Number(decoded.sub);

    const body = await c.req.json();
    const { body: regResponse, challenge } = body;

    if (!regResponse || !challenge) {
      return reply(c, { status: "error", message: "Datos incompletos" }, 400);
    }

    // Verify challenge
    const storedChallenge = getChallenge(`register:${challenge}`);
    if (!storedChallenge || storedChallenge.userId !== userId) {
      return reply(c, { status: "error", message: "Challenge inv?lido" }, 400);
    }

    const verification = await verifyRegistrationResponse({
      response: regResponse,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return reply(
        c,
        { status: "error", message: "Verificaci?n fallida" },
        400
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    // Save credential to Passkey table
    await db.passkey.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: regResponse.response.transports || undefined,
        webAuthnUserID: String(userId),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        friendlyName: "Passkey (" + new Date().toLocaleDateString() + ")",
      },
    });

    return reply(c, {
      status: "ok",
      message: "Passkey registrado exitosamente",
    });
  } catch (error) {
    console.error("[passkey] register verify error:", error);
    return reply(c, { status: "error", message: "Error de verificaci?n" }, 500);
  }
});

// PASSKEY REMOVE
authRoutes.delete("/passkey/remove", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  try {
    const decoded = await verifyToken(token);
    const userId = Number(decoded.sub);

    // Remove all passkeys for the user (or specific one if ID provided in query? For now Wipe All)
    await db.passkey.deleteMany({
      where: { userId },
    });

    return reply(c, { status: "ok", message: "Passkey eliminado" });
  } catch (error) {
    console.error("[passkey] remove error:", error);
    return reply(
      c,
      { status: "error", message: "Error eliminando passkey" },
      500
    );
  }
});
