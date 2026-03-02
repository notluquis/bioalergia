/**
 * User Routes for Hono API
 *
 * Manages user CRUD, role assignment, MFA, passkeys, and onboarding
 */

import { db } from "@finanzas/db";
import { Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { hashPassword } from "../lib/crypto";
import { normalizeRut } from "../lib/rut";
import { zValidator } from "../lib/zod-validator";
import { reply } from "../utils/reply";

export const userRoutes = new Hono();

// Helper to get auth from cookie
async function getAuth(c: Parameters<typeof getSessionUser>[0]) {
  const sessionUser = await getSessionUser(c);
  if (!sessionUser) {
    return null;
  }
  return {
    userId: sessionUser.id,
    email: sessionUser.email,
    roles: sessionUser.roles.map((role) => role.role.name),
  };
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
  loginEmail: z.email("Email de login inválido").optional(),
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

const updateUserProfileSchema = z
  .object({
    address: z.string().max(255).nullable().optional(),
    bankAccountNumber: z.string().max(120).nullable().optional(),
    bankAccountType: z.string().max(80).nullable().optional(),
    bankName: z.string().max(120).nullable().optional(),
    department: z.string().max(120).nullable().optional(),
    email: z.email("Email inválido").optional(),
    fatherName: z.string().max(120).nullable().optional(),
    loginEmail: z.email("Email de login inválido").nullable().optional(),
    mfaEnforced: z.boolean().optional(),
    motherName: z.string().max(120).nullable().optional(),
    names: z.string().min(1, "Nombres requeridos").max(160),
    notificationEmail: z.email("Email de notificación inválido").optional(),
    phone: z.string().max(60).nullable().optional(),
    position: z.string().min(1, "Cargo requerido").max(120),
    rut: z.string().min(1, "RUT requerido").max(20),
  })
  .superRefine((value, ctx) => {
    if (!value.notificationEmail && !value.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "notificationEmail es requerido",
        path: ["notificationEmail"],
      });
    }
  });

type InviteUserPayload = z.infer<typeof inviteUserSchema>;

function toNullableText(value: null | string | undefined): null | string {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: string) {
  return value.toLowerCase().trim();
}

async function findUserByEffectiveLoginEmail(email: string, excludeUserId?: number) {
  const rows = await db.$queryRaw<Array<{ id: number }>>`
    SELECT u.id
    FROM users u
    JOIN people p ON p.id = u.person_id
    WHERE lower(coalesce(nullif(u.login_email, ''), p.email)) = lower(${email})
      AND (${excludeUserId ?? 0} = 0 OR u.id <> ${excludeUserId ?? 0})
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function getUserLoginEmailMap(userIds: number[]) {
  if (userIds.length === 0) {
    return new Map<number, null | string>();
  }

  const rows = await db.$queryRaw<Array<{ id: number; loginEmail: null | string }>>`
    SELECT u.id AS "id", u.login_email AS "loginEmail"
    FROM users u
    WHERE u.id = ANY(${userIds})
  `;

  return new Map<number, null | string>(rows.map((row) => [row.id, row.loginEmail]));
}

async function resolveInvitePersonId(
  personId: number | undefined,
  email: string,
  payload: InviteUserPayload,
) {
  if (!personId) {
    const names = payload.names?.trim();
    const rut = payload.rut?.trim();
    if (!names) {
      throw new Error("PERSON_NAME_REQUIRED");
    }
    if (!rut) {
      throw new Error("PERSON_RUT_REQUIRED");
    }

    const person = await db.person.create({
      data: {
        names,
        fatherName: toNullableText(payload.fatherName),
        motherName: toNullableText(payload.motherName),
        email,
        rut,
      },
    });
    return person.id;
  }

  const linkedPerson = await db.person.findUnique({ where: { id: personId } });
  if (!linkedPerson) {
    throw new Error("PERSON_NOT_FOUND");
  }

  const linkedEmail = linkedPerson.email?.toLowerCase().trim();
  if (!linkedEmail) {
    await db.person.update({
      where: { id: linkedPerson.id },
      data: { email },
    });
    return linkedPerson.id;
  }

  if (linkedEmail !== email) {
    throw new Error("PERSON_EMAIL_CONFLICT");
  }

  return linkedPerson.id;
}

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
            person: {
              OR: [{ email: { contains: "test" } }, { email: { contains: "debug" } }],
            },
          },
    include: {
      person: { include: { employee: true } },
      roles: { include: { role: true } },
      passkeys: { select: { id: true } },
    },
    orderBy: { person: { names: "asc" } },
  });

  const loginEmailByUserId = await getUserLoginEmailMap(users.map((user) => user.id));

  const safeUsers = users.map((u) => ({
    id: u.id,
    email: u.person?.email ?? "",
    notificationEmail: u.person?.email ?? "",
    loginEmail: loginEmailByUserId.get(u.id)?.trim() || (u.person?.email ?? ""),
    status: u.status,
    mfaEnabled: u.mfaEnabled,
    mfaEnforced: u.mfaEnforced,
    hasPasskey: u.passkeys.length > 0,
    createdAt: u.createdAt,
    role: u.roles[0]?.role.name || "VIEWER",
    employee: u.person?.employee
      ? {
          position: u.person.employee.position,
          department: u.person.employee.department,
          bankName: u.person.employee.bankName,
          bankAccountType: u.person.employee.bankAccountType,
          bankAccountNumber: u.person.employee.bankAccountNumber,
        }
      : null,
    person: u.person
      ? {
          address: u.person.address,
          names: u.person.names,
          fatherName: u.person.fatherName,
          motherName: u.person.motherName,
          phone: u.person.phone,
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

  const loginEmailRow = await db.$queryRaw<Array<{ loginEmail: null | string }>>`
    SELECT u.login_email AS "loginEmail"
    FROM users u
    WHERE u.id = ${auth.userId}
    LIMIT 1
  `;
  const explicitLoginEmail = loginEmailRow[0]?.loginEmail?.trim() || null;
  const notificationEmail = user.person?.email ?? "";
  const effectiveLoginEmail = explicitLoginEmail || notificationEmail;

  return reply(c, {
    status: "ok",
    data: {
      names: user.person.names,
      fatherName: user.person.fatherName,
      motherName: user.person.motherName,
      rut: normalizeRut(user.person.rut),
      email: notificationEmail,
      notificationEmail,
      loginEmail: effectiveLoginEmail,
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
  const normalizedEmail = normalizeEmail(email);

  // Check if user exists
  const existing = await db.user.findFirst({ where: { person: { email: normalizedEmail } } });
  if (existing) {
    return reply(c, { status: "error", message: "Email ya registrado" }, 400);
  }

  const loginConflict = await findUserByEffectiveLoginEmail(normalizedEmail);
  if (loginConflict) {
    return reply(c, { status: "error", message: "Email ya está en uso para login" }, 409);
  }

  // Generate temp password
  const crypto = await import("node:crypto");
  const tempPassword = crypto.randomBytes(12).toString("hex");
  const tempPasswordHash = await hashPassword(tempPassword);

  let targetPersonId = personId;
  try {
    targetPersonId = await resolveInvitePersonId(targetPersonId, normalizedEmail, {
      email,
      fatherName,
      mfaEnforced,
      motherName,
      names,
      personId,
      position,
      role,
      rut,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PERSON_NAME_REQUIRED") {
      return reply(c, { status: "error", message: "Nombres son requeridos" }, 400);
    }
    if (error instanceof Error && error.message === "PERSON_RUT_REQUIRED") {
      return reply(c, { status: "error", message: "RUT es requerido" }, 400);
    }
    if (error instanceof Error && error.message === "PERSON_NOT_FOUND") {
      return reply(c, { status: "error", message: "Persona no encontrada" }, 404);
    }
    if (error instanceof Error && error.message === "PERSON_EMAIL_CONFLICT") {
      return reply(
        c,
        {
          status: "error",
          message:
            "La persona vinculada ya tiene otro email. Actualiza el email de la persona primero.",
        },
        409,
      );
    }
    throw error;
  }

  const user = await db.user.create({
    data: {
      personId: targetPersonId,
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
  const normalizedNotificationEmail = normalizeEmail(user.person?.email ?? "");
  const normalizedLoginEmail = body.loginEmail ? normalizeEmail(body.loginEmail) : null;
  const effectiveLoginEmail = normalizedLoginEmail || normalizedNotificationEmail;

  if (!effectiveLoginEmail) {
    return reply(
      c,
      {
        status: "error",
        message: "No existe correo válido para login. Contacta a un administrador.",
      },
      409,
    );
  }

  const conflictingLogin = await findUserByEffectiveLoginEmail(effectiveLoginEmail, auth.userId);
  if (conflictingLogin) {
    return reply(c, { status: "error", message: "El correo de login ya está en uso" }, 409);
  }

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

  const explicitLoginEmail =
    normalizedLoginEmail && normalizedLoginEmail !== normalizedNotificationEmail
      ? normalizedLoginEmail
      : null;
  await db.$executeRaw`
    UPDATE users
    SET login_email = ${explicitLoginEmail}
    WHERE id = ${auth.userId}
  `;

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
  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!targetUser) {
    return reply(c, { status: "error", message: "Usuario no encontrado" }, 404);
  }

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
      sessionVersion: { increment: 1 },
    },
  });

  console.log("[User] Password reset by", auth.email, "for user", targetUserId);
  return reply(c, { status: "ok", tempPassword });
});

// ============================================================
// UPDATE USER PROFILE (ADMIN)
// ============================================================

userRoutes.put(
  "/:id/profile",
  zValidator("param", idParamSchema),
  zValidator("json", updateUserProfileSchema),
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
    const body = c.req.valid("json");

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      include: {
        person: {
          include: { employee: true },
        },
      },
    });
    if (!targetUser) {
      return reply(c, { status: "error", message: "Usuario no encontrado" }, 404);
    }

    const notificationEmailInput = body.notificationEmail ?? body.email;
    if (!notificationEmailInput) {
      return reply(c, { status: "error", message: "Email de notificación requerido" }, 400);
    }
    const normalizedNotificationEmail = normalizeEmail(notificationEmailInput);
    const normalizedLoginEmail = body.loginEmail ? normalizeEmail(body.loginEmail) : null;
    const explicitLoginEmail =
      normalizedLoginEmail && normalizedLoginEmail !== normalizedNotificationEmail
        ? normalizedLoginEmail
        : null;
    const effectiveLoginEmail = explicitLoginEmail ?? normalizedNotificationEmail;
    const normalizedRut = normalizeRut(body.rut);
    if (!normalizedRut) {
      return reply(c, { status: "error", message: "RUT inválido" }, 400);
    }

    const [conflictingEmail, conflictingRut, conflictingLogin] = await Promise.all([
      db.person.findFirst({
        where: {
          email: normalizedNotificationEmail,
          NOT: { id: targetUser.personId },
        },
        select: { id: true },
      }),
      db.person.findFirst({
        where: {
          rut: normalizedRut,
          NOT: { id: targetUser.personId },
        },
        select: { id: true },
      }),
      findUserByEffectiveLoginEmail(effectiveLoginEmail, targetUserId),
    ]);

    if (conflictingEmail) {
      return reply(
        c,
        { status: "error", message: "El correo de notificación ya está en uso por otro usuario" },
        409,
      );
    }
    if (conflictingRut) {
      return reply(c, { status: "error", message: "El RUT ya está en uso por otro usuario" }, 409);
    }
    if (conflictingLogin) {
      return reply(c, { status: "error", message: "El correo de login ya está en uso" }, 409);
    }

    await db.$transaction(async (tx) => {
      await tx.person.update({
        where: { id: targetUser.personId },
        data: {
          address: toNullableText(body.address),
          email: normalizedNotificationEmail,
          fatherName: toNullableText(body.fatherName),
          motherName: toNullableText(body.motherName),
          names: body.names.trim(),
          phone: toNullableText(body.phone),
          rut: normalizedRut,
        },
      });

      await tx.employee.upsert({
        where: { personId: targetUser.personId },
        create: {
          personId: targetUser.personId,
          position: body.position.trim(),
          department: toNullableText(body.department),
          startDate: targetUser.person.employee?.startDate ?? new Date(),
          status: targetUser.person.employee?.status ?? "ACTIVE",
          bankName: toNullableText(body.bankName),
          bankAccountType: toNullableText(body.bankAccountType),
          bankAccountNumber: toNullableText(body.bankAccountNumber),
        },
        update: {
          position: body.position.trim(),
          department: toNullableText(body.department),
          bankName: toNullableText(body.bankName),
          bankAccountType: toNullableText(body.bankAccountType),
          bankAccountNumber: toNullableText(body.bankAccountNumber),
        },
      });

      if (typeof body.mfaEnforced === "boolean") {
        await tx.user.update({
          where: { id: targetUserId },
          data: { mfaEnforced: body.mfaEnforced },
        });
      }

      await tx.$executeRaw`
        UPDATE users
        SET login_email = ${explicitLoginEmail}
        WHERE id = ${targetUserId}
      `;
    });

    return reply(c, { status: "ok" });
  },
);

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
