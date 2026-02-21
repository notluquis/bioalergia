/**
 * Auth Routes for Hono API
 *
 * Handles login, logout, session, MFA, and passkey authentication
 */

import { db } from "@finanzas/db";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { signToken, verifyToken } from "../lib/paseto";
import { errorReply } from "../utils/error-reply";
import { replyRaw } from "../utils/reply";

const COOKIE_NAME = "finanzas_session";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 2, // 2 days
  path: "/",
};

export const authRoutes = new Hono();

function authError(c: Context, status: ContentfulStatusCode, message: string) {
  return errorReply(c, status, message, { code: "AUTH_ERROR" });
}

// Prevent caching of auth responses (security + UX)
authRoutes.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
});

// Types
interface AuthSession {
  userId: number;
  email: string;
  roles: string[];
  sessionVersion: number;
}

async function issueToken(session: AuthSession): Promise<string> {
  return signToken(
    {
      sub: session.userId.toString(),
      email: session.email,
      roles: session.roles,
      sv: session.sessionVersion,
    },
    "2d",
  );
}

async function resolveSessionFromToken(token: string) {
  const decoded = await verifyToken(token);
  if (!decoded || typeof decoded.sub !== "string") {
    return null;
  }
  const userId = Number(decoded.sub);
  if (!Number.isFinite(userId)) {
    return null;
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, sessionVersion: true, person: { select: { email: true } } },
  });
  if (!user) {
    return null;
  }
  const tokenSessionVersion =
    typeof decoded.sv === "number" && Number.isFinite(decoded.sv) ? decoded.sv : 1;
  if (tokenSessionVersion !== user.sessionVersion) {
    return null;
  }
  return {
    decoded,
    userId: user.id,
    userEmail: user.person?.email ?? String(decoded.email ?? ""),
  };
}

import { z } from "zod";
import { zValidator } from "../lib/zod-validator";

// ... existing imports ...

// ============================================================
// SCHEMAS
// ============================================================

const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

const mfaLoginSchema = z.object({
  userId: z.number().int(),
  token: z.string().min(6, "Token inválido"),
});

const mfaEnableSchema = z.object({
  token: z.string().min(6, "Token inválido"),
});

// PASSKEY SCHEMAS
// Note: Passkey bodies are complex JSONs from simplewebauthn, we can be slightly looser or use their types if possible,
// for now we validate structure existence
const passkeyVerifySchema = z.object({
  body: z.record(z.string(), z.unknown()),
  challenge: z.string().min(1, "Challenge required"),
});

const passkeyResponseSchema = z.object({
  body: z.record(z.string(), z.unknown()),
  challenge: z.string().min(1),
});

// ============================================================
// LOGIN
// ============================================================

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase().trim();

  // Find user with ZenStack
  const baseInclude = {
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
  } as const;

  const user = await db.user.findFirst({
    where: { person: { email: normalizedEmail } },
    include: baseInclude,
  });

  if (!user || !user.passwordHash) {
    return authError(c, 401, "Credenciales incorrectas");
  }

  // Import crypto verification (Argon2)
  const { verifyPassword, hashPassword } = await import("../lib/crypto.js");
  const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    return authError(c, 401, "Credenciales incorrectas");
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
    return replyRaw(c, { status: "mfa_required", userId: user.id });
  }

  // Build roles array
  const roles = user.roles.map((r) => r.role.name);
  const userEmail = user.person?.email ?? normalizedEmail;

  // Issue token and set cookie
  const token = await issueToken({
    userId: user.id,
    email: userEmail,
    roles,
    sessionVersion: user.sessionVersion,
  });
  setCookie(c, COOKIE_NAME, token, COOKIE_OPTIONS);

  const { getAbilityRulesForUser } = await import("../services/authz.js");
  const abilityRules = await getAbilityRulesForUser(user.id);

  return replyRaw(c, {
    status: "ok",
    user: {
      id: user.id,
      email: userEmail,
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

authRoutes.post("/login/mfa", zValidator("json", mfaLoginSchema), async (c) => {
  const { userId, token: mfaToken } = c.req.valid("json");

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      person: true,
      roles: { include: { role: true } },
    },
  });

  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    return authError(c, 400, "MFA no configurado");
  }

  // Verify MFA token
  const { verifyMfaToken } = await import("../services/mfa.js");
  const isValid = await verifyMfaToken(mfaToken, user.mfaSecret);

  if (!isValid) {
    return authError(c, 401, "Código incorrecto");
  }

  const roles = user.roles.map((r) => r.role.name);
  const userEmail = user.person?.email ?? "";
  const token = await issueToken({
    userId: user.id,
    email: userEmail,
    roles,
    sessionVersion: user.sessionVersion,
  });
  setCookie(c, COOKIE_NAME, token, COOKIE_OPTIONS);

  const { getAbilityRulesForUser } = await import("../services/authz.js");
  const abilityRules = await getAbilityRulesForUser(user.id);

  return replyRaw(c, {
    status: "ok",
    user: {
      id: user.id,
      email: userEmail,
      name: user.person?.names || null,
      roles,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
    },
    abilityRules,
  });
});

// ============================================================
// LOGOUT
// ============================================================

authRoutes.post("/logout", async (c) => {
  deleteCookie(c, COOKIE_NAME);
  return replyRaw(c, { status: "ok" });
});

// ============================================================
// SESSION
// ============================================================

authRoutes.get("/me/session", async (c) => {
  const token = getCookie(c, COOKIE_NAME);

  if (!token) {
    return replyRaw(c, { status: "ok", user: null });
  }

  try {
    const session = await resolveSessionFromToken(token);
    if (!session) {
      deleteCookie(c, COOKIE_NAME);
      return replyRaw(c, { status: "ok", user: null });
    }
    const userId = session.userId;

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
      return replyRaw(c, { status: "ok", user: null });
    }
    // --- Role Governance Logic ---
    const { getAbilityRulesForUser } = await import("../services/authz.js");
    const abilityRules = await getAbilityRulesForUser(user.id);

    return replyRaw(c, {
      status: "ok",
      user: {
        id: user.id,
        email: user.person?.email ?? "",
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
    return replyRaw(c, { status: "ok", user: null });
  }
});

// ============================================================
// MFA SETUP
// ============================================================

authRoutes.post("/mfa/setup", async (c) => {
  // Requires auth - extract from cookie
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return authError(c, 401, "No autorizado");
  }

  try {
    const session = await resolveSessionFromToken(token);
    if (!session) {
      return authError(c, 401, "Token inválido");
    }
    const userId = session.userId;
    const email = session.userEmail;

    const { generateMfaSecret } = await import("../services/mfa.js");
    const { secret, qrCodeUrl } = await generateMfaSecret(email);

    await db.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });

    return replyRaw(c, { status: "ok", secret, qrCodeUrl });
  } catch {
    return authError(c, 401, "Token inválido");
  }
});

authRoutes.post("/mfa/enable", zValidator("json", mfaEnableSchema), async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return authError(c, 401, "No autorizado");
  }

  try {
    const session = await resolveSessionFromToken(token);
    if (!session) {
      return authError(c, 401, "Token inválido");
    }
    const userId = session.userId;

    const { token: mfaToken } = c.req.valid("json");

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      return authError(c, 400, "MFA setup no iniciado");
    }

    const { verifyMfaToken } = await import("../services/mfa.js");
    const isValid = await verifyMfaToken(mfaToken, user.mfaSecret);

    if (!isValid) {
      return authError(c, 400, "Código incorrecto");
    }

    await db.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return replyRaw(c, { status: "ok" });
  } catch {
    return authError(c, 401, "Token inválido");
  }
});

authRoutes.post("/mfa/disable", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return authError(c, 401, "No autorizado");
  }

  try {
    const session = await resolveSessionFromToken(token);
    if (!session) {
      return authError(c, 401, "Token inválido");
    }
    const userId = session.userId;

    await db.user.update({
      where: { id: userId },
      data: { mfaSecret: null, mfaEnabled: false },
    });

    return replyRaw(c, { status: "ok" });
  } catch {
    return authError(c, 401, "Token inválido");
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
const challengeStore = new Map<string, { challenge: string; userId?: number; expires: number }>();

function storeChallenge(key: string, challenge: string, userId?: number): void {
  challengeStore.set(key, {
    challenge,
    userId,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}

function getChallenge(key: string): { challenge: string; userId?: number } | null {
  const entry = challengeStore.get(key);
  if (!entry) {
    return null;
  }
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
    console.log("[passkey] Generating login options...");
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");

    // Use empty allowCredentials for discoverable (usernameless) login
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "preferred",
      allowCredentials: [], // Allow any discoverable credential (usernameless)
    });

    console.log("[passkey] Options generated successfully", {
      challenge: `${options.challenge?.slice(0, 20)}...`,
      rpID: RP_ID,
    });

    // Store challenge for verification
    storeChallenge(`login:${options.challenge}`, options.challenge);

    return replyRaw(c, options);
  } catch (error) {
    console.error("[passkey] login options error:", error);
    return authError(c, 500, "Error generando opciones");
  }
});

// PASSKEY LOGIN VERIFY
authRoutes.post("/passkey/login/verify", zValidator("json", passkeyVerifySchema), async (c) => {
  try {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { body: authResponse, challenge } = c.req.valid("json");

    // Verify challenge exists
    const storedChallenge = getChallenge(`login:${challenge}`);
    if (!storedChallenge) {
      return authError(c, 400, "Challenge inválido o expirado");
    }

    // Find passkey by credential ID
    // Note: authResponse is typed as unknown in schema, but we cast it or use it assuming structure matches simplewebauthn expectations
    // We need to access id safely.
    const responseBody = authResponse as unknown as AuthenticationResponseJSON;
    const credentialID = responseBody.id;

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
      return authError(c, 401, "Credencial no encontrada");
    }
    const user = passkey.user;

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: responseBody,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: (passkey.transports as AuthenticatorTransportFuture[] | null) || undefined,
      },
    });

    if (!verification.verified) {
      return authError(c, 401, "Verificación fallida");
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
      email: user.person?.email ?? "",
      roles,
      sessionVersion: user.sessionVersion,
    });
    setCookie(c, COOKIE_NAME, token, COOKIE_OPTIONS);

    const { getAbilityRulesForUser: getAbilityRulesForUser2 } = await import(
      "../services/authz.js"
    );
    const abilityRules = await getAbilityRulesForUser2(user.id);

    return replyRaw(c, {
      status: "ok",
      user: {
        id: user.id,
        email: user.person?.email ?? "",
        name: user.person?.names || null,
        roles,
        status: user.status,
        mfaEnabled: user.mfaEnabled,
      },
      abilityRules,
    });
  } catch (error) {
    console.error("[passkey] login verify error:", error);
    return authError(c, 500, "Error de verificación");
  }
});

// PASSKEY REGISTER OPTIONS
authRoutes.get("/passkey/register/options", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return authError(c, 401, "No autorizado");
  }

  try {
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const session = await resolveSessionFromToken(token);
    if (!session) {
      return authError(c, 401, "Token inválido");
    }
    const userId = session.userId;
    const email = session.userEmail;

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { person: true },
    });

    if (!user) {
      return authError(c, 404, "Usuario no encontrado");
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(String(userId))),
      userName: user.person?.email || email,
      userDisplayName: user.person?.names || user.person?.email || email,
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

    return replyRaw(c, options);
  } catch (error) {
    console.error("[passkey] register options error:", error);
    return authError(c, 500, "Error generando opciones");
  }
});

// PASSKEY REGISTER VERIFY
authRoutes.post(
  "/passkey/register/verify",
  zValidator("json", passkeyResponseSchema),
  async (c) => {
    const sessionToken = getCookie(c, COOKIE_NAME);
    if (!sessionToken) {
      return authError(c, 401, "No autorizado");
    }

    try {
      const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
      const session = await resolveSessionFromToken(sessionToken);
      if (!session) {
        return authError(c, 401, "Token inválido");
      }
      const userId = session.userId;

      const { body: regResponse, challenge } = c.req.valid("json");

      // Verify challenge
      const storedChallenge = getChallenge(`register:${challenge}`);
      if (!storedChallenge || storedChallenge.userId !== userId) {
        return authError(c, 400, "Challenge inválido");
      }

      // Note: regResponse is typed as unknown by Zod, but simplewebauthn expects a specific structure.
      // We cast it to `any` for library compatibility, as the library itself performs validation.
      const responseBody = regResponse as unknown as RegistrationResponseJSON;

      const verification = await verifyRegistrationResponse({
        response: responseBody,
        expectedChallenge: challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return authError(c, 400, "Verificación fallida");
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
          transports: responseBody.response.transports ?? undefined,
          webAuthnUserID: String(userId),
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          friendlyName: `Passkey (${new Date().toLocaleDateString()})`,
        },
      });

      return replyRaw(c, {
        status: "ok",
        message: "Passkey registrado exitosamente",
      });
    } catch (error) {
      console.error("[passkey] register verify error:", error);
      return authError(c, 500, "Error de verificación");
    }
  },
);

// PASSKEY REMOVE
authRoutes.delete("/passkey/remove", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return authError(c, 401, "No autorizado");
  }

  try {
    const session = await resolveSessionFromToken(token);
    if (!session) {
      return authError(c, 401, "Token inválido");
    }
    const userId = session.userId;

    // Remove all passkeys for the user (or specific one if ID provided in query? For now Wipe All)
    await db.passkey.deleteMany({
      where: { userId },
    });

    return replyRaw(c, { status: "ok", message: "Passkey eliminado" });
  } catch (error) {
    console.error("[passkey] remove error:", error);
    return authError(c, 500, "Error eliminando passkey");
  }
});
