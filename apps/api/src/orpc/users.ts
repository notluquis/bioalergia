import { db } from "@finanzas/db";
import {
  inviteResponseSchema,
  inviteUserSchema,
  resetPasswordResponseSchema,
  setupUserSchema,
  toggleMfaResponseSchema,
  toggleMfaSchema,
  updateRoleSchema,
  updateStatusSchema,
  updateUserProfileSchema,
  userIdSchema,
  userListItemSchema,
  userProfileResponseSchema,
  userProfileSchema,
  usersContract,
  usersListInputSchema,
  usersResponseSchema,
  usersStatusResponseSchema,
  userStatusSchema,
} from "@finanzas/orpc-contracts/users";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { hashPassword } from "../lib/crypto";
import { logError } from "../lib/logger";
import { normalizeRut } from "../lib/rut";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type UsersORPCContext = {
  hono: HonoContext;
};

const base = os.$context<UsersORPCContext>();

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
  payload: (typeof inviteUserSchema)["_output"],
) {
  if (!personId) {
    const names = payload.names?.trim();
    const rut = payload.rut?.trim();

    if (!names) {
      throw new ORPCError("BAD_REQUEST", { message: "Nombres son requeridos" });
    }

    if (!rut) {
      throw new ORPCError("BAD_REQUEST", { message: "RUT es requerido" });
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
    throw new ORPCError("NOT_FOUND", { message: "Persona no encontrada" });
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
    throw new ORPCError("CONFLICT", {
      message:
        "La persona vinculada ya tiene otro email. Actualiza el email de la persona primero.",
    });
  }

  return linkedPerson.id;
}

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readUsers = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "User");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createUsers = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "User");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "No tienes permisos para crear usuarios" });
  }

  return next();
});

const updateUsers = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "User");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const deleteUsers = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user.id, "delete", "User");

  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const usersORPCRouterBase = {
  delete: deleteUsers
    .route(usersContract.delete)
    .handler(async ({ context, input }) => {
      if (input.id === context.user.id) {
        throw new ORPCError("BAD_REQUEST", { message: "No puedes eliminar tu propia cuenta" });
      }

      await db.user.delete({ where: { id: input.id } });
      return { status: "ok" as const };
    }),

  deletePasskey: updateUsers
    .route(usersContract.deletePasskey)
    .handler(async ({ input }) => {
      await db.passkey.deleteMany({
        where: { userId: input.id },
      });

      return { status: "ok" as const };
    }),

  invite: createUsers
    .route(usersContract.invite)
    .handler(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);

      const existing = await db.user.findFirst({
        where: { person: { email: normalizedEmail } },
      });
      if (existing) {
        throw new ORPCError("BAD_REQUEST", { message: "Email ya registrado" });
      }

      const loginConflict = await findUserByEffectiveLoginEmail(normalizedEmail);
      if (loginConflict) {
        throw new ORPCError("CONFLICT", { message: "Email ya está en uso para login" });
      }

      const crypto = await import("node:crypto");
      const tempPassword = crypto.randomBytes(12).toString("hex");
      const tempPasswordHash = await hashPassword(tempPassword);

      const targetPersonId = await resolveInvitePersonId(input.personId, normalizedEmail, input);

      const user = await db.user.create({
        data: {
          personId: targetPersonId,
          passwordHash: tempPasswordHash,
          status: "PENDING_SETUP",
          mfaEnforced: input.mfaEnforced,
        },
      });

      const roleRecord = await db.role.findUnique({ where: { name: input.role } });
      if (roleRecord) {
        await db.userRoleAssignment.create({
          data: { userId: user.id, roleId: roleRecord.id },
        });
      }

      await db.employee.upsert({
        where: { personId: targetPersonId },
        create: {
          personId: targetPersonId,
          position: input.position,
          startDate: new Date(),
          status: "ACTIVE",
        },
        update: { position: input.position },
      });

      return { status: "ok" as const, userId: user.id, tempPassword };
    }),

  list: readUsers
    .route(usersContract.list)
    .handler(async ({ input }) => {
      const users = await db.user.findMany({
        where: input.includeTest
          ? undefined
          : {
              NOT: {
                person: {
                  OR: [{ email: { contains: "test" } }, { email: { contains: "debug" } }],
                },
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

      return {
        status: "ok" as const,
        users: users.map((user) => ({
          createdAt: user.createdAt,
          email: user.person?.email ?? "",
          notificationEmail: user.person?.email ?? "",
          loginEmail: loginEmailByUserId.get(user.id)?.trim() || (user.person?.email ?? ""),
          status: user.status as (typeof userStatusSchema)["_output"],
          mfaEnabled: user.mfaEnabled,
          mfaEnforced: user.mfaEnforced,
          hasPasskey: user.passkeys.length > 0,
          passkeysCount: user.passkeys.length,
          id: user.id,
          role: user.roles[0]?.role.name || "VIEWER",
          employee: user.person?.employee
            ? {
                position: user.person.employee.position,
                department: user.person.employee.department,
                bankName: user.person.employee.bankName,
                bankAccountType: user.person.employee.bankAccountType,
                bankAccountNumber: user.person.employee.bankAccountNumber,
              }
            : null,
          person: user.person
            ? {
                address: user.person.address,
                names: user.person.names,
                fatherName: user.person.fatherName,
                motherName: user.person.motherName,
                phone: user.person.phone,
                rut: normalizeRut(user.person.rut),
              }
            : null,
        })),
      };
    }),

  profile: authed
    .route(usersContract.profile)
    .handler(async ({ context }) => {
      const user = await db.user.findUnique({
        where: { id: context.user.id },
        include: { person: { include: { employee: true } } },
      });

      if (!user) {
        throw new ORPCError("NOT_FOUND", { message: "Usuario no encontrado" });
      }

      if (!user.person) {
        throw new ORPCError("NOT_FOUND", { message: "Datos personales no encontrados" });
      }

      const loginEmailRow = await db.$queryRaw<Array<{ loginEmail: null | string }>>`
        SELECT u.login_email AS "loginEmail"
        FROM users u
        WHERE u.id = ${context.user.id}
        LIMIT 1
      `;

      const explicitLoginEmail = loginEmailRow[0]?.loginEmail?.trim() || null;
      const notificationEmail = user.person.email ?? "";
      const effectiveLoginEmail = explicitLoginEmail || notificationEmail;

      return {
        status: "ok" as const,
        data: {
          id: user.id,
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
      };
    }),

  resetPassword: updateUsers
    .route(usersContract.resetPassword)
    .handler(async ({ input }) => {
      const targetUser = await db.user.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!targetUser) {
        throw new ORPCError("NOT_FOUND", { message: "Usuario no encontrado" });
      }

      const crypto = await import("node:crypto");
      const tempPassword = crypto.randomBytes(12).toString("hex");
      const passwordHash = await hashPassword(tempPassword);

      await db.user.update({
        where: { id: input.id },
        data: {
          passwordHash,
          status: "PENDING_SETUP",
          mfaEnabled: false,
          mfaSecret: null,
          sessionVersion: { increment: 1 },
        },
      });

      return { status: "ok" as const, tempPassword };
    }),

  setup: authed
    .route(usersContract.setup)
    .handler(async ({ context, input }) => {
      const user = await db.user.findUnique({
        where: { id: context.user.id },
        include: { person: true },
      });

      if (!user) {
        throw new ORPCError("NOT_FOUND", { message: "Usuario no encontrado" });
      }

      if (user.status === "ACTIVE") {
        return { status: "ok" as const, message: "Cuenta ya configurada" };
      }

      if (user.status !== "PENDING_SETUP") {
        throw new ORPCError("CONFLICT", {
          message: "Estado de usuario no válido para setup",
        });
      }

      const hash = await hashPassword(input.password);
      const normalizedNotificationEmail = normalizeEmail(user.person?.email ?? "");
      const normalizedLoginEmail = input.loginEmail ? normalizeEmail(input.loginEmail) : null;
      const effectiveLoginEmail = normalizedLoginEmail || normalizedNotificationEmail;

      if (!effectiveLoginEmail) {
        throw new ORPCError("CONFLICT", {
          message: "No existe correo válido para login. Contacta a un administrador.",
        });
      }

      const conflictingLogin = await findUserByEffectiveLoginEmail(
        effectiveLoginEmail,
        context.user.id,
      );
      if (conflictingLogin) {
        throw new ORPCError("CONFLICT", { message: "El correo de login ya está en uso" });
      }

      await db.person.update({
        where: { id: user.personId },
        data: {
          names: input.names,
          fatherName: input.fatherName,
          motherName: input.motherName,
          rut: input.rut,
          phone: input.phone,
          address: input.address,
        },
      });

      await db.employee.upsert({
        where: { personId: user.personId },
        create: {
          personId: user.personId,
          position: "Por definir",
          startDate: new Date(),
          bankName: input.bankName,
          bankAccountType: input.bankAccountType,
          bankAccountNumber: input.bankAccountNumber,
        },
        update: {
          bankName: input.bankName,
          bankAccountType: input.bankAccountType,
          bankAccountNumber: input.bankAccountNumber,
        },
      });

      await db.user.update({
        where: { id: context.user.id },
        data: { passwordHash: hash, status: "ACTIVE" },
      });

      const explicitLoginEmail =
        normalizedLoginEmail && normalizedLoginEmail !== normalizedNotificationEmail
          ? normalizedLoginEmail
          : null;

      await db.$executeRaw`
        UPDATE users
        SET login_email = ${explicitLoginEmail}
        WHERE id = ${context.user.id}
      `;

      return { status: "ok" as const, message: "Configuración completada" };
    }),

  toggleMfa: updateUsers
    .route(usersContract.toggleMfa)
    .handler(async ({ input }) => {
      await db.user.update({
        where: { id: input.id },
        data: { mfaEnabled: input.enabled },
      });

      return { status: "ok" as const, mfaEnabled: input.enabled };
    }),

  updateProfile: updateUsers
    .route(usersContract.updateProfile)
    .handler(async ({ input }) => {
      const targetUser = await db.user.findUnique({
        where: { id: input.id },
        include: {
          person: {
            include: { employee: true },
          },
        },
      });

      if (!targetUser) {
        throw new ORPCError("NOT_FOUND", { message: "Usuario no encontrado" });
      }

      const notificationEmailInput = input.payload.notificationEmail ?? input.payload.email;
      if (!notificationEmailInput) {
        throw new ORPCError("BAD_REQUEST", { message: "Email de notificación requerido" });
      }

      const normalizedNotificationEmail = normalizeEmail(notificationEmailInput);
      const normalizedLoginEmail = input.payload.loginEmail
        ? normalizeEmail(input.payload.loginEmail)
        : null;
      const explicitLoginEmail =
        normalizedLoginEmail && normalizedLoginEmail !== normalizedNotificationEmail
          ? normalizedLoginEmail
          : null;
      const effectiveLoginEmail = explicitLoginEmail ?? normalizedNotificationEmail;
      const normalizedRut = normalizeRut(input.payload.rut);

      if (!normalizedRut) {
        throw new ORPCError("BAD_REQUEST", { message: "RUT inválido" });
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
        findUserByEffectiveLoginEmail(effectiveLoginEmail, input.id),
      ]);

      if (conflictingEmail) {
        throw new ORPCError("CONFLICT", {
          message: "El correo de notificación ya está en uso por otro usuario",
        });
      }

      if (conflictingRut) {
        throw new ORPCError("CONFLICT", { message: "El RUT ya está en uso por otro usuario" });
      }

      if (conflictingLogin) {
        throw new ORPCError("CONFLICT", { message: "El correo de login ya está en uso" });
      }

      await db.$transaction(async (tx) => {
        await tx.person.update({
          where: { id: targetUser.personId },
          data: {
            address: toNullableText(input.payload.address),
            email: normalizedNotificationEmail,
            fatherName: toNullableText(input.payload.fatherName),
            motherName: toNullableText(input.payload.motherName),
            names: input.payload.names.trim(),
            phone: toNullableText(input.payload.phone),
            rut: normalizedRut,
          },
        });

        await tx.employee.upsert({
          where: { personId: targetUser.personId },
          create: {
            personId: targetUser.personId,
            position: input.payload.position.trim(),
            department: toNullableText(input.payload.department),
            startDate: targetUser.person.employee?.startDate ?? new Date(),
            status: targetUser.person.employee?.status ?? "ACTIVE",
            bankName: toNullableText(input.payload.bankName),
            bankAccountType: toNullableText(input.payload.bankAccountType),
            bankAccountNumber: toNullableText(input.payload.bankAccountNumber),
          },
          update: {
            position: input.payload.position.trim(),
            department: toNullableText(input.payload.department),
            bankName: toNullableText(input.payload.bankName),
            bankAccountType: toNullableText(input.payload.bankAccountType),
            bankAccountNumber: toNullableText(input.payload.bankAccountNumber),
          },
        });

        if (typeof input.payload.mfaEnforced === "boolean") {
          await tx.user.update({
            where: { id: input.id },
            data: { mfaEnforced: input.payload.mfaEnforced },
          });
        }

        await tx.$executeRaw`
          UPDATE users
          SET login_email = ${explicitLoginEmail}
          WHERE id = ${input.id}
        `;
      });

      return { status: "ok" as const };
    }),

  updateRole: updateUsers
    .route(usersContract.updateRole)
    .handler(async ({ input }) => {
      await db.userRoleAssignment.deleteMany({ where: { userId: input.id } });

      const roleRecord = await db.role.findUnique({ where: { name: input.role } });
      if (roleRecord) {
        await db.userRoleAssignment.create({
          data: { userId: input.id, roleId: roleRecord.id },
        });
      }

      return { status: "ok" as const };
    }),

  updateStatus: updateUsers
    .route(usersContract.updateStatus)
    .handler(async ({ context, input }) => {
      if (
        input.id === context.user.id &&
        (input.status === "SUSPENDED" || input.status === "PENDING_SETUP")
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No puedes cambiar tu propia cuenta a este estado",
        });
      }

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: input.id },
          data: {
            status: input.status,
            sessionVersion: { increment: 1 },
            ...(input.status === "PENDING_SETUP"
              ? {
                  mfaEnabled: false,
                  mfaSecret: null,
                }
              : {}),
          },
        });

        if (input.status === "PENDING_SETUP") {
          await tx.passkey.deleteMany({
            where: { userId: input.id },
          });
        }
      });

      return { status: "ok" as const };
    }),
};

export const usersORPCRouter = base.prefix("/api/orpc/users").router(usersORPCRouterBase);

export const usersORPCHandler = new SuperJSONRPCHandler(usersORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.users",
      });
    }),
  ],
});

export const usersOpenAPIHandler = new OpenAPIHandler(usersORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Users oRPC",
          description: "Contratos oRPC/OpenAPI para gestión de usuarios.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.users",
      });
    }),
  ],
});

export type UsersORPCRouter = typeof usersORPCRouter;
