import { db } from "@finanzas/db";
import type {
  updateOwnProfileSchema,
  updateStatusSchema,
  updateUserProfileSchema,
} from "@finanzas/orpc-contracts/users";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { normalizeRut } from "../lib/rut.ts";

// Lógica de negocio de usuarios, fuera de los handlers oRPC. Los servicios
// validan y lanzan DomainError (mapeado a HTTP por orpc/error.ts::toORPCError
// vía el SuperJSONRPCHandler); los handlers quedan finos. Mantener el
// db.$transaction acá (service layer, contexto de tipos liviano) evita el
// TS2321 "Excessive stack depth" del TransactionClientContract profundo.

type UpdateUserProfilePayload = z.infer<typeof updateUserProfileSchema>;
type UpdateOwnProfilePayload = z.infer<typeof updateOwnProfileSchema>;
type UserStatus = z.infer<typeof updateStatusSchema>["status"];

export function normalizeEmail(value: string): string {
  return value.toLowerCase().trim();
}

export function toNullableText(value: null | string | undefined): null | string {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Busca un usuario cuyo login efectivo (login_email, o el email de la persona si
// aquel es vacío) coincide, excluyendo opcionalmente un userId.
export async function findUserByEffectiveLoginEmail(
  email: string,
  excludeUserId?: number
): Promise<{ id: number } | null> {
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

// Edición admin de perfil (admin tool): valida unicidad de email/RUT/login y
// persiste persona + empleado + flags en una transacción.
export async function updateUserProfile(
  userId: number,
  payload: UpdateUserProfilePayload
): Promise<void> {
  const targetUser = await db.user.findUnique({
    where: { id: userId },
    include: { person: { include: { employee: true } } },
  });
  if (!targetUser) {
    throw new DomainError("NOT_FOUND", "Usuario no encontrado");
  }

  const notificationEmailInput = payload.notificationEmail ?? payload.email;
  if (!notificationEmailInput) {
    throw new DomainError("BAD_REQUEST", "Email de notificación requerido");
  }

  const normalizedNotificationEmail = normalizeEmail(notificationEmailInput);
  const normalizedLoginEmail = payload.loginEmail ? normalizeEmail(payload.loginEmail) : null;
  const explicitLoginEmail =
    normalizedLoginEmail && normalizedLoginEmail !== normalizedNotificationEmail
      ? normalizedLoginEmail
      : null;
  const effectiveLoginEmail = explicitLoginEmail ?? normalizedNotificationEmail;
  const normalizedRut = normalizeRut(payload.rut);
  if (!normalizedRut) {
    throw new DomainError("BAD_REQUEST", "RUT inválido");
  }

  const [conflictingEmail, conflictingRut, conflictingLogin] = await Promise.all([
    db.person.findFirst({
      where: { email: normalizedNotificationEmail, NOT: { id: targetUser.personId } },
      select: { id: true },
    }),
    db.person.findFirst({
      where: { rut: normalizedRut, NOT: { id: targetUser.personId } },
      select: { id: true },
    }),
    findUserByEffectiveLoginEmail(effectiveLoginEmail, userId),
  ]);

  if (conflictingEmail) {
    throw new DomainError("CONFLICT", "El correo de notificación ya está en uso por otro usuario");
  }
  if (conflictingRut) {
    throw new DomainError("CONFLICT", "El RUT ya está en uso por otro usuario");
  }
  if (conflictingLogin) {
    throw new DomainError("CONFLICT", "El correo de login ya está en uso");
  }

  await db.$transaction(async (tx) => {
    await tx.person.update({
      where: { id: targetUser.personId },
      data: {
        email: normalizedNotificationEmail,
        fatherName: toNullableText(payload.fatherName),
        motherName: toNullableText(payload.motherName),
        names: payload.names.trim(),
        phone: toNullableText(payload.phone),
        rut: normalizedRut,
      },
    });

    await tx.employee.upsert({
      where: { personId: targetUser.personId },
      create: {
        personId: targetUser.personId,
        position: payload.position.trim(),
        department: toNullableText(payload.department),
        startDate: targetUser.person.employee?.startDate ?? new Date(),
        status: targetUser.person.employee?.status ?? "ACTIVE",
        bankName: toNullableText(payload.bankName),
        bankAccountType: toNullableText(payload.bankAccountType),
        bankAccountNumber: toNullableText(payload.bankAccountNumber),
      },
      update: {
        position: payload.position.trim(),
        department: toNullableText(payload.department),
        bankName: toNullableText(payload.bankName),
        bankAccountType: toNullableText(payload.bankAccountType),
        bankAccountNumber: toNullableText(payload.bankAccountNumber),
      },
    });

    if (typeof payload.mfaEnforced === "boolean") {
      await tx.user.update({
        where: { id: userId },
        data: { mfaEnforced: payload.mfaEnforced },
      });
    }

    await tx.$executeRaw`
      UPDATE users
      SET login_email = ${explicitLoginEmail}
      WHERE id = ${userId}
    `;
  });
}

// Self-service (cuenta propia): no toca email/rut/mfa; position solo en create.
export async function updateOwnProfile(
  userId: number,
  payload: UpdateOwnProfilePayload
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { person: { include: { employee: true } } },
  });
  if (!user || !user.person) {
    throw new DomainError("NOT_FOUND", "Usuario no encontrado");
  }

  const normalizedNotificationEmail = normalizeEmail(user.person.email ?? "");
  const normalizedLoginEmail = payload.loginEmail ? normalizeEmail(payload.loginEmail) : null;
  const explicitLoginEmail =
    normalizedLoginEmail && normalizedLoginEmail !== normalizedNotificationEmail
      ? normalizedLoginEmail
      : null;
  const effectiveLoginEmail = explicitLoginEmail ?? normalizedNotificationEmail;

  if (effectiveLoginEmail) {
    const conflictingLogin = await findUserByEffectiveLoginEmail(effectiveLoginEmail, userId);
    if (conflictingLogin) {
      throw new DomainError("CONFLICT", "El correo de login ya está en uso");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.person.update({
      where: { id: user.personId },
      data: {
        names: payload.names.trim(),
        fatherName: toNullableText(payload.fatherName),
        motherName: toNullableText(payload.motherName),
        phone: toNullableText(payload.phone),
      },
    });

    await tx.employee.upsert({
      where: { personId: user.personId },
      create: {
        personId: user.personId,
        position: user.person.employee?.position ?? "Por definir",
        startDate: user.person.employee?.startDate ?? new Date(),
        status: user.person.employee?.status ?? "ACTIVE",
        bankName: toNullableText(payload.bankName),
        bankAccountType: toNullableText(payload.bankAccountType),
        bankAccountNumber: toNullableText(payload.bankAccountNumber),
      },
      update: {
        bankName: toNullableText(payload.bankName),
        bankAccountType: toNullableText(payload.bankAccountType),
        bankAccountNumber: toNullableText(payload.bankAccountNumber),
      },
    });

    await tx.$executeRaw`
      UPDATE users
      SET login_email = ${explicitLoginEmail}
      WHERE id = ${userId}
    `;
  });
}

// Cambio de estado de usuario (incrementa sessionVersion → invalida sesiones;
// limpia MFA/passkeys al volver a PENDING_SETUP). El guard de "no tu propia
// cuenta" queda en el handler (necesita el id del solicitante).
export async function updateUserStatus(userId: number, status: UserStatus): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status,
        sessionVersion: { increment: 1 },
        ...(status === "PENDING_SETUP" ? { mfaEnabled: false, mfaSecret: null } : {}),
      },
    });

    if (status === "PENDING_SETUP") {
      await tx.passkey.deleteMany({ where: { userId } });
    }
  });
}
