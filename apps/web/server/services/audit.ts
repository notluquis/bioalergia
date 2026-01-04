import { Prisma } from "@prisma/client";

import { prisma } from "../prisma.js";

export type AuditAction =
  | "USER_INVITE"
  | "USER_SETUP"
  | "USER_PASSWORD_RESET"
  | "USER_ROLE_UPDATE"
  | "USER_MFA_RESET"
  | "PERSON_CREATE"
  | "PERSON_UPDATE"
  | "SETTINGS_UPDATE"
  | "USER_PASSKEY_DELETE";

interface LogAuditParams {
  userId?: number;
  action: AuditAction;
  entity: string;
  entityId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit({ userId, action, entity, entityId, details, ipAddress }: LogAuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        details: details ? (details as Prisma.InputJsonValue) : undefined,
        ipAddress,
      },
    });
  } catch (error) {
    // Audit logging should not block the main flow, but we should log the error
    console.error("Failed to create audit log:", error);
  }
}
