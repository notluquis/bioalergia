/**
 * User Routes for Hono API
 *
 * Manages user CRUD, role assignment, MFA, passkeys, and onboarding
 */

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import jwt from "jsonwebtoken";
import { db } from "@finanzas/db";
import { hashPassword } from "../lib/crypto";
import { normalizeRut } from "../lib/rut";

const JWT_SECRET = process.env.JWT_SECRET || "";
const COOKIE_NAME = "finanzas_session";

export const userRoutes = new Hono();

// Helper to get auth from cookie
function getAuth(c: { req: { header: (name: string) => string | undefined } }) {
  const cookieHeader = c.req.header("Cookie");
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => c.trim().split("=")),
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return {
      userId: Number(decoded.sub),
      email: String(decoded.email),
      roles: decoded.roles as string[],
    };
  } catch {
    return null;
  }
}

// ============================================================
// LIST USERS
// ============================================================

userRoutes.get("/", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const includeTest = c.req.query("includeTest") === "true";

  const users = await db.user.findMany({
    where: includeTest
      ? undefined
      : {
          NOT: {
            OR: [
              { email: { contains: "test" } },
              { email: { contains: "debug" } },
            ],
          },
        },
    include: {
      person: true,
      roles: { include: { role: true } },
    },
    orderBy: { email: "asc" },
  });

  const safeUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    status: u.status,
    mfaEnabled: u.mfaEnabled,
    hasPasskey: !!u.passkeyCredentialID,
    createdAt: u.createdAt,
    role: u.roles[0]?.role.name || "VIEWER",
    person: u.person
      ? {
          names: u.person.names,
          fatherName: u.person.fatherName,
          rut: normalizeRut(u.person.rut),
        }
      : null,
  }));

  return c.json({ status: "ok", users: safeUsers });
});

// ============================================================
// GET USER PROFILE
// ============================================================

userRoutes.get("/profile", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    include: { person: { include: { employee: true } } },
  });

  if (!user)
    return c.json({ status: "error", message: "Usuario no encontrado" }, 404);

  return c.json({
    status: "ok",
    data: {
      names: user.person.names,
      fatherName: user.person.fatherName,
      motherName: user.person.motherName,
      rut: normalizeRut(user.person.rut),
      email: user.email,
      phone: user.person.phone,
      address: user.person.address,
      bankName: user.person.employee?.bankName,
      bankAccountType: user.person.employee?.bankAccountType,
      bankAccountNumber: user.person.employee?.bankAccountNumber,
    },
  });
});

// ============================================================
// INVITE USER
// ============================================================

userRoutes.post("/invite", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const body = await c.req.json<{
    email: string;
    role: string;
    position: string;
    mfaEnforced?: boolean;
    personId?: number;
  }>();
  const { email, role, position, mfaEnforced = true, personId } = body;

  if (!email || !role || !position) {
    return c.json(
      { status: "error", message: "Campos requeridos: email, role, position" },
      400,
    );
  }

  // Check if user exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing)
    return c.json({ status: "error", message: "Email ya registrado" }, 400);

  // Generate temp password
  const crypto = await import("crypto");
  const tempPasswordHash = await hashPassword(
    crypto.randomBytes(12).toString("hex"),
  );

  // Create user
  let targetPersonId = personId;
  if (!targetPersonId) {
    const person = await db.person.create({
      data: { names: "Nuevo Usuario", email, rut: `TEMP-${Date.now()}` },
    });
    targetPersonId = person.id;
  }

  const user = await db.user.create({
    data: {
      personId: targetPersonId,
      email: email.toLowerCase(),
      passwordHash: tempPasswordHash,
      status: "PENDING_SETUP",
      mfaEnforced,
    },
  });

  // Assign role
  const roleRecord = await db.role.findUnique({ where: { name: role } });
  if (roleRecord) {
    await db.userRoleAssignment.create({
      data: { userId: user.id, roleId: roleRecord.id },
    });
  }

  // Create employee
  await db.employee.upsert({
    where: { personId: targetPersonId },
    create: {
      personId: targetPersonId,
      position,
      startDate: new Date(),
      status: "ACTIVE",
    },
    update: { position },
  });

  console.log("[User] Invited:", email, "by", auth.email);
  return c.json({ status: "ok", userId: user.id });
});

// ============================================================
// USER SETUP (ONBOARDING)
// ============================================================

userRoutes.post("/setup", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const body = await c.req.json<{
    names: string;
    fatherName?: string;
    motherName?: string;
    rut: string;
    phone?: string;
    address?: string;
    bankName?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
    password: string;
  }>();

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    include: { person: true },
  });
  if (!user)
    return c.json({ status: "error", message: "Usuario no encontrado" }, 404);

  if (user.status !== "PENDING_SETUP") {
    return c.json({ status: "error", message: "Cuenta ya configurada" }, 403);
  }

  const hash = await hashPassword(body.password);

  await db.person.update({
    where: { id: user.personId },
    data: {
      names: body.names,
      fatherName: body.fatherName,
      motherName: body.motherName,
      rut: body.rut,
      phone: body.phone,
      address: body.address,
    },
  });

  await db.employee.upsert({
    where: { personId: user.personId },
    create: {
      personId: user.personId,
      position: "Por definir",
      startDate: new Date(),
      bankName: body.bankName,
      bankAccountType: body.bankAccountType,
      bankAccountNumber: body.bankAccountNumber,
    },
    update: {
      bankName: body.bankName,
      bankAccountType: body.bankAccountType,
      bankAccountNumber: body.bankAccountNumber,
    },
  });

  await db.user.update({
    where: { id: auth.userId },
    data: { passwordHash: hash, status: "ACTIVE" },
  });

  console.log("[User] Setup complete:", auth.email);
  return c.json({ status: "ok", message: "Configuración completada" });
});

// ============================================================
// RESET PASSWORD (ADMIN)
// ============================================================

userRoutes.post("/:id/reset-password", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const targetUserId = Number(c.req.param("id"));
  if (isNaN(targetUserId))
    return c.json({ status: "error", message: "ID inválido" }, 400);

  const crypto = await import("crypto");
  const tempPassword = crypto.randomBytes(12).toString("hex");
  const passwordHash = await hashPassword(tempPassword);

  await db.user.update({
    where: { id: targetUserId },
    data: {
      passwordHash,
      status: "PENDING_SETUP",
      mfaEnabled: false,
      mfaSecret: null,
      passkeyCredentialID: null,
      passkeyPublicKey: null,
      passkeyCounter: BigInt(0),
    },
  });

  console.log("[User] Password reset by", auth.email, "for user", targetUserId);
  return c.json({ status: "ok", tempPassword });
});

// ============================================================
// UPDATE STATUS
// ============================================================

userRoutes.put("/:id/status", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const targetUserId = Number(c.req.param("id"));
  const { status } = await c.req.json<{ status: string }>();

  if (!["ACTIVE", "SUSPENDED"].includes(status)) {
    return c.json({ status: "error", message: "Estado inválido" }, 400);
  }

  if (targetUserId === auth.userId) {
    return c.json(
      { status: "error", message: "No puedes suspender tu propia cuenta" },
      400,
    );
  }

  await db.user.update({
    where: { id: targetUserId },
    data: { status: status as "ACTIVE" | "SUSPENDED" },
  });

  console.log(
    "[User] Status updated by",
    auth.email,
    ":",
    targetUserId,
    "->",
    status,
  );
  return c.json({ status: "ok" });
});

// ============================================================
// UPDATE ROLE
// ============================================================

userRoutes.put("/:id/role", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const targetUserId = Number(c.req.param("id"));
  const { role } = await c.req.json<{ role: string }>();

  // Remove existing roles
  await db.userRoleAssignment.deleteMany({ where: { userId: targetUserId } });

  // Assign new role
  const roleRecord = await db.role.findUnique({ where: { name: role } });
  if (roleRecord) {
    await db.userRoleAssignment.create({
      data: { userId: targetUserId, roleId: roleRecord.id },
    });
  }

  console.log(
    "[User] Role updated by",
    auth.email,
    ":",
    targetUserId,
    "->",
    role,
  );
  return c.json({ status: "ok" });
});

// ============================================================
// DELETE USER
// ============================================================

userRoutes.delete("/:id", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const targetUserId = Number(c.req.param("id"));

  if (targetUserId === auth.userId) {
    return c.json(
      { status: "error", message: "No puedes eliminar tu propia cuenta" },
      400,
    );
  }

  await db.user.delete({ where: { id: targetUserId } });

  console.log("[User] Deleted by", auth.email, ":", targetUserId);
  return c.json({ status: "ok" });
});

// ============================================================
// MFA TOGGLE (ADMIN)
// ============================================================

userRoutes.post("/:id/mfa/toggle", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const targetUserId = Number(c.req.param("id"));
  const { enabled } = await c.req.json<{ enabled: boolean }>();

  await db.user.update({
    where: { id: targetUserId },
    data: { mfaEnabled: enabled },
  });

  console.log(
    "[User] MFA toggled by",
    auth.email,
    ":",
    targetUserId,
    "->",
    enabled,
  );
  return c.json({ status: "ok", mfaEnabled: enabled });
});

// ============================================================
// DELETE MFA (ADMIN RESET)
// ============================================================

userRoutes.delete("/:id/mfa", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const targetUserId = Number(c.req.param("id"));

  await db.user.update({
    where: { id: targetUserId },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  console.log("[User] MFA disabled by", auth.email, "for", targetUserId);
  return c.json({ status: "ok" });
});

// ============================================================
// DELETE PASSKEY (ADMIN)
// ============================================================

userRoutes.delete("/:id/passkey", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const targetUserId = Number(c.req.param("id"));

  await db.user.update({
    where: { id: targetUserId },
    data: {
      passkeyCredentialID: null,
      passkeyPublicKey: null,
      passkeyCounter: BigInt(0),
    },
  });

  console.log("[User] Passkey removed by", auth.email, "for", targetUserId);
  return c.json({ status: "ok" });
});
