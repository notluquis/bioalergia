/**
 * User Routes for Hono API
 *
 * Manages user CRUD, role assignment, MFA, passkeys, and onboarding
 */

import { db } from "@finanzas/db";
import type { Context } from "hono";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { hasPermission } from "../auth";
import { hashPassword } from "../lib/crypto";
import { verifyToken } from "../lib/paseto";
import { normalizeRut } from "../lib/rut";
import { zValidator } from "../lib/zod-validator";
import { reply } from "../utils/reply";

const COOKIE_NAME = "finanzas_session";

export const userRoutes = new Hono();

// Helper to get auth from cookie
async function getAuth(c: Context) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return null;
  }
  try {
    const decoded = await verifyToken(token);
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
// SCHEMAS
// ============================================================

const listUsersQuerySchema = z.object({
  includeTest: z.enum(["true", "false"]).optional(),
});

const inviteUserSchema = z.object({
  email: z.email("Email inválido"),
  role: z.string().min(1, "Rol requerido"),
  position: z.string().min(1, "Cargo requerido"),
  mfaEnforced: z.boolean().optional().default(true),
  personId: z.number().int().optional(),
  names: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  rut: z.string().optional(),
});

const setupUserSchema = z.object({
  names: z.string().min(1),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  rut: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountType: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID debe ser numérico").transform(Number),
});

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

const updateRoleSchema = z.object({
  role: z.string().min(1, "Rol requerido"),
});

const toggleMfaSchema = z.object({
  enabled: z.boolean(),
});

// ============================================================
// LIST USERS
// ============================================================

// LIST USERS
userRoutes.get("/", zValidator("query", listUsersQuerySchema), async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canRead = await hasPermission(auth.userId, "read", "User");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { includeTest } = c.req.valid("query");

  const users = await db.user.findMany({
    where:
      includeTest === "true"
        ? undefined
        : {
            NOT: {
              OR: [{ email: { contains: "test" } }, { email: { contains: "debug" } }],
            },
          },
    include: {
      person: true,
      roles: { include: { role: true } },
      passkeys: { select: { id: true } },
    },
    orderBy: { email: "asc" },
  });

  const safeUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    status: u.status,
    mfaEnabled: u.mfaEnabled,
    hasPasskey: u.passkeys.length > 0,
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

  return reply(c, { status: "ok", users: safeUsers });
});

// ============================================================
// GET USER PROFILE
// ============================================================

userRoutes.get("/profile", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    include: { person: { include: { employee: true } } },
  });

  if (!user) {
    return reply(c, { status: "error", message: "Usuario no encontrado" }, 404);
  }

  return reply(c, {
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

userRoutes.post("/invite", zValidator("json", inviteUserSchema), async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canCreate = await hasPermission(auth.userId, "create", "User");
  if (!canCreate) {
    return reply(c, { status: "error", message: "No tienes permisos para crear usuarios" }, 403);
  }

  const { email, role, position, mfaEnforced, personId, names, fatherName, motherName, rut } =
    c.req.valid("json");

  // Check if user exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return reply(c, { status: "error", message: "Email ya registrado" }, 400);
  }

  // Generate temp password
  const crypto = await import("node:crypto");
  const tempPassword = crypto.randomBytes(12).toString("hex");
  const tempPasswordHash = await hashPassword(tempPassword);

  // Create user
  let targetPersonId = personId;
  if (!targetPersonId) {
    const person = await db.person.create({
      data: {
        names: names || "Nuevo Usuario",
        fatherName: fatherName || "",
        motherName: motherName || "",
        email,
        rut: rut || `TEMP-${Date.now()}`,
      },
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
  return reply(c, { status: "ok", userId: user.id, tempPassword });
});

// ============================================================
// USER SETUP (ONBOARDING)
// ============================================================

userRoutes.post("/setup", zValidator("json", setupUserSchema), async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const body = c.req.valid("json");

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    include: { person: true },
  });
  if (!user) {
    return reply(c, { status: "error", message: "Usuario no encontrado" }, 404);
  }

  if (user.status === "ACTIVE") {
    return reply(c, { status: "ok", message: "Cuenta ya configurada" });
  }

  if (user.status !== "PENDING_SETUP") {
    return reply(c, { status: "error", message: "Estado de usuario no válido para setup" }, 409);
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
  return reply(c, { status: "ok", message: "Configuración completada" });
});

// ============================================================
// RESET PASSWORD (ADMIN)
// ============================================================

userRoutes.post("/:id/reset-password", zValidator("param", idParamSchema), async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canUpdate = await hasPermission(auth.userId, "update", "User");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { id: targetUserId } = c.req.valid("param");

  const crypto = await import("node:crypto");
  const tempPassword = crypto.randomBytes(12).toString("hex");
  const passwordHash = await hashPassword(tempPassword);

  await db.user.update({
    where: { id: targetUserId },
    data: {
      passwordHash,
      status: "PENDING_SETUP",
      mfaEnabled: false,
      mfaSecret: null,
    },
  });

  console.log("[User] Password reset by", auth.email, "for user", targetUserId);
  return reply(c, { status: "ok", tempPassword });
});

// ============================================================
// UPDATE STATUS
// ============================================================

userRoutes.put(
  "/:id/status",
  zValidator("param", idParamSchema),
  zValidator("json", updateStatusSchema),
  async (c) => {
    const auth = await getAuth(c);
    if (!auth) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canUpdate = await hasPermission(auth.userId, "update", "User");
    if (!canUpdate) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    const { id: targetUserId } = c.req.valid("param");
    const { status } = c.req.valid("json");

    if (targetUserId === auth.userId) {
      return reply(c, { status: "error", message: "No puedes suspender tu propia cuenta" }, 400);
    }

    await db.user.update({
      where: { id: targetUserId },
      data: { status },
    });

    console.log("[User] Status updated by", auth.email, ":", targetUserId, "->", status);
    return reply(c, { status: "ok" });
  },
);

// ============================================================
// UPDATE ROLE
// ============================================================

userRoutes.put(
  "/:id/role",
  zValidator("param", idParamSchema),
  zValidator("json", updateRoleSchema),
  async (c) => {
    const auth = await getAuth(c);
    if (!auth) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canUpdate = await hasPermission(auth.userId, "update", "User");
    if (!canUpdate) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    const { id: targetUserId } = c.req.valid("param");
    const { role } = c.req.valid("json");

    // Remove existing roles
    await db.userRoleAssignment.deleteMany({ where: { userId: targetUserId } });

    // Assign new role
    const roleRecord = await db.role.findUnique({ where: { name: role } });
    if (roleRecord) {
      await db.userRoleAssignment.create({
        data: { userId: targetUserId, roleId: roleRecord.id },
      });
    }

    console.log("[User] Role updated by", auth.email, ":", targetUserId, "->", role);
    return reply(c, { status: "ok" });
  },
);

// ============================================================
// DELETE USER
// ============================================================

userRoutes.delete("/:id", zValidator("param", idParamSchema), async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canDelete = await hasPermission(auth.userId, "delete", "User");
  if (!canDelete) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { id: targetUserId } = c.req.valid("param");

  if (targetUserId === auth.userId) {
    return reply(c, { status: "error", message: "No puedes eliminar tu propia cuenta" }, 400);
  }

  await db.user.delete({ where: { id: targetUserId } });

  console.log("[User] Deleted by", auth.email, ":", targetUserId);
  return reply(c, { status: "ok" });
});

// ============================================================
// MFA TOGGLE (ADMIN)
// ============================================================

userRoutes.post(
  "/:id/mfa/toggle",
  zValidator("param", idParamSchema),
  zValidator("json", toggleMfaSchema),
  async (c) => {
    const auth = await getAuth(c);
    if (!auth) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canUpdate = await hasPermission(auth.userId, "update", "User");
    if (!canUpdate) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    const { id: targetUserId } = c.req.valid("param");
    const { enabled } = c.req.valid("json");

    await db.user.update({
      where: { id: targetUserId },
      data: { mfaEnabled: enabled },
    });

    console.log("[User] MFA toggled by", auth.email, ":", targetUserId, "->", enabled);
    return reply(c, { status: "ok", mfaEnabled: enabled });
  },
);

// ============================================================
// DELETE MFA (ADMIN RESET)
// ============================================================

userRoutes.delete("/:id/mfa", zValidator("param", idParamSchema), async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canUpdate = await hasPermission(auth.userId, "update", "User");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { id: targetUserId } = c.req.valid("param");

  await db.user.update({
    where: { id: targetUserId },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  console.log("[User] MFA disabled by", auth.email, "for", targetUserId);
  return reply(c, { status: "ok" });
});

// ============================================================
// DELETE PASSKEY (ADMIN)
// ============================================================

userRoutes.delete("/:id/passkey", zValidator("param", idParamSchema), async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canUpdate = await hasPermission(auth.userId, "update", "User");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { id: targetUserId } = c.req.valid("param");

  await db.user.update({
    where: { id: targetUserId },
    data: {
      // Passkey removal is now handled by deleting entries from logic, but here we just leave empty since it's a delete op on relation usually
      // For now, removing legacy update
    },
  });

  await db.passkey.deleteMany({
    where: { userId: targetUserId },
  });

  console.log("[User] Passkey removed by", auth.email, "for", targetUserId);
  return reply(c, { status: "ok" });
});
