/**
 * Auth Routes for Hono API
 *
 * Handles login, logout, session, MFA, and passkey authentication
 */

import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import jwt from "jsonwebtoken";
import { db } from "@finanzas/db";

const JWT_SECRET = process.env.JWT_SECRET || "";
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

function issueToken(session: AuthSession): string {
  return jwt.sign(
    {
      sub: session.userId.toString(),
      email: session.email,
      roles: session.roles,
    },
    JWT_SECRET,
    { expiresIn: "2d" },
  );
}

// ============================================================
// LOGIN
// ============================================================

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const { email, password } = body;

  if (!email || !password) {
    return c.json(
      { status: "error", message: "Email y contraseña requeridos" },
      400,
    );
  }

  // Find user with ZenStack
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      person: true,
      roles: {
        include: { role: true },
      },
    },
  });

  if (!user || !user.passwordHash) {
    return c.json(
      { status: "error", message: "Credenciales incorrectas" },
      401,
    );
  }

  // Import crypto verification (Argon2)
  const { verifyPassword, hashPassword } = await import("../lib/crypto.js");
  const { valid, needsRehash } = await verifyPassword(
    password,
    user.passwordHash,
  );

  if (!valid) {
    return c.json(
      { status: "error", message: "Credenciales incorrectas" },
      401,
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
    return c.json({ status: "mfa_required", userId: user.id });
  }

  // Build roles array
  const roles = user.roles.map((r) => r.role.name);

  // Issue token and set cookie
  const token = issueToken({ userId: user.id, email: user.email, roles });
  setCookie(c, COOKIE_NAME, token, COOKIE_OPTIONS);

  return c.json({
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
// MFA LOGIN
// ============================================================

authRoutes.post("/login/mfa", async (c) => {
  const body = await c.req.json<{ userId: number; token: string }>();
  const { userId, token: mfaToken } = body;

  if (!userId || !mfaToken) {
    return c.json(
      { status: "error", message: "userId y token requeridos" },
      400,
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
    return c.json({ status: "error", message: "MFA no configurado" }, 400);
  }

  // Verify MFA token
  const { verifyMfaToken } = await import("../services/mfa.js");
  const isValid = verifyMfaToken(mfaToken, user.mfaSecret);

  if (!isValid) {
    return c.json({ status: "error", message: "Código incorrecto" }, 401);
  }

  const roles = user.roles.map((r) => r.role.name);
  const token = issueToken({ userId: user.id, email: user.email, roles });
  setCookie(c, COOKIE_NAME, token, COOKIE_OPTIONS);

  return c.json({
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
  return c.json({ status: "ok" });
});

// ============================================================
// SESSION
// ============================================================

authRoutes.get("/me/session", async (c) => {
  const token = getCookie(c, COOKIE_NAME);

  if (!token) {
    return c.json({ status: "ok", user: null });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const userId = Number(decoded.sub);

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        person: true,
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      deleteCookie(c, COOKIE_NAME);
      return c.json({ status: "ok", user: null });
    }

    return c.json({
      status: "ok",
      user: {
        id: user.id,
        email: user.email,
        name: user.person?.names || null,
        roles: user.roles.map((r) => r.role.name),
        status: user.status,
        mfaEnabled: user.mfaEnabled,
        mfaEnforced: user.mfaEnforced,
        hasPasskey: !!user.passkeyCredentialID,
      },
    });
  } catch {
    deleteCookie(c, COOKIE_NAME);
    return c.json({ status: "ok", user: null });
  }
});

// ============================================================
// MFA SETUP
// ============================================================

authRoutes.post("/mfa/setup", async (c) => {
  // Requires auth - extract from cookie
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ status: "error", message: "No autorizado" }, 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const userId = Number(decoded.sub);
    const email = String(decoded.email);

    const { generateMfaSecret } = await import("../services/mfa.js");
    const { secret, qrCodeUrl } = await generateMfaSecret(email);

    await db.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });

    return c.json({ status: "ok", secret, qrCodeUrl });
  } catch {
    return c.json({ status: "error", message: "Token inválido" }, 401);
  }
});

authRoutes.post("/mfa/enable", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ status: "error", message: "No autorizado" }, 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const userId = Number(decoded.sub);

    const body = await c.req.json<{ token: string }>();

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      return c.json({ status: "error", message: "MFA setup no iniciado" }, 400);
    }

    const { verifyMfaToken } = await import("../services/mfa.js");
    const isValid = verifyMfaToken(body.token, user.mfaSecret);

    if (!isValid) {
      return c.json({ status: "error", message: "Código incorrecto" }, 400);
    }

    await db.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return c.json({ status: "ok" });
  } catch {
    return c.json({ status: "error", message: "Token inválido" }, 401);
  }
});

authRoutes.post("/mfa/disable", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ status: "error", message: "No autorizado" }, 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const userId = Number(decoded.sub);

    await db.user.update({
      where: { id: userId },
      data: { mfaSecret: null, mfaEnabled: false },
    });

    return c.json({ status: "ok" });
  } catch {
    return c.json({ status: "error", message: "Token inválido" }, 401);
  }
});
