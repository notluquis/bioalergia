import { db } from "@finanzas/db";
import type { updateStatusSchema } from "@finanzas/orpc-contracts/users";
import type { z } from "zod";

type UserStatus = z.infer<typeof updateStatusSchema>["status"];

// Persiste el update de perfil de usuario en una transacción, fuera del handler
// oRPC. Mantener el db.$transaction en el service layer (contexto de tipos
// liviano) evita el TS2321 "Excessive stack depth" del TransactionClientContract
// profundo al instanciarse inline en el handler pesado. La pre-validación y la
// traducción de errores (ORPCError) quedan en el handler; este recibe valores ya
// normalizados y solo escribe.
export interface PersistUserProfileUpdateArgs {
  userId: number;
  personId: number;
  names: string;
  fatherName: null | string;
  motherName: null | string;
  phone: null | string;
  notificationEmail: string;
  rut: string;
  position: string;
  department: null | string;
  bankName: null | string;
  bankAccountType: null | string;
  bankAccountNumber: null | string;
  mfaEnforced?: boolean;
  explicitLoginEmail: null | string;
  fallbackStartDate: Date;
  fallbackStatus: "ACTIVE" | "INACTIVE" | "TERMINATED";
}

export async function persistUserProfileUpdate(args: PersistUserProfileUpdateArgs): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.person.update({
      where: { id: args.personId },
      data: {
        email: args.notificationEmail,
        fatherName: args.fatherName,
        motherName: args.motherName,
        names: args.names,
        phone: args.phone,
        rut: args.rut,
      },
    });

    await tx.employee.upsert({
      where: { personId: args.personId },
      create: {
        personId: args.personId,
        position: args.position,
        department: args.department,
        startDate: args.fallbackStartDate,
        status: args.fallbackStatus,
        bankName: args.bankName,
        bankAccountType: args.bankAccountType,
        bankAccountNumber: args.bankAccountNumber,
      },
      update: {
        position: args.position,
        department: args.department,
        bankName: args.bankName,
        bankAccountType: args.bankAccountType,
        bankAccountNumber: args.bankAccountNumber,
      },
    });

    if (typeof args.mfaEnforced === "boolean") {
      await tx.user.update({
        where: { id: args.userId },
        data: { mfaEnforced: args.mfaEnforced },
      });
    }

    await tx.$executeRaw`
      UPDATE users
      SET login_email = ${args.explicitLoginEmail}
      WHERE id = ${args.userId}
    `;
  });
}

// Self-service profile update (no toca email/rut/mfa; position solo en create).
export interface PersistOwnProfileUpdateArgs {
  userId: number;
  personId: number;
  names: string;
  fatherName: null | string;
  motherName: null | string;
  phone: null | string;
  bankName: null | string;
  bankAccountType: null | string;
  bankAccountNumber: null | string;
  explicitLoginEmail: null | string;
  fallbackPosition: string;
  fallbackStartDate: Date;
  fallbackStatus: "ACTIVE" | "INACTIVE" | "TERMINATED";
}

export async function persistOwnProfileUpdate(args: PersistOwnProfileUpdateArgs): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.person.update({
      where: { id: args.personId },
      data: {
        names: args.names,
        fatherName: args.fatherName,
        motherName: args.motherName,
        phone: args.phone,
      },
    });

    await tx.employee.upsert({
      where: { personId: args.personId },
      create: {
        personId: args.personId,
        position: args.fallbackPosition,
        startDate: args.fallbackStartDate,
        status: args.fallbackStatus,
        bankName: args.bankName,
        bankAccountType: args.bankAccountType,
        bankAccountNumber: args.bankAccountNumber,
      },
      update: {
        bankName: args.bankName,
        bankAccountType: args.bankAccountType,
        bankAccountNumber: args.bankAccountNumber,
      },
    });

    await tx.$executeRaw`
      UPDATE users
      SET login_email = ${args.explicitLoginEmail}
      WHERE id = ${args.userId}
    `;
  });
}

// Cambio de estado de usuario (incrementa sessionVersion → invalida sesiones;
// limpia MFA/passkeys al volver a PENDING_SETUP).
export async function persistUserStatusUpdate(userId: number, status: UserStatus): Promise<void> {
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
