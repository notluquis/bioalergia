/**
 * Audit Service for Hono API
 * Logs audit events to the database
 */

import { db, JsonObject } from "@finanzas/db";

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

export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  details,
  ipAddress,
}: LogAuditParams) {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        details: details
          ? (JSON.parse(JSON.stringify(details)) as JsonObject)
          : undefined,
        ipAddress,
      },
    });
  } catch (error) {
    console.error("[Audit] Failed to create log:", error);
  }
}
// ... imports

/**
 * Get distinct tables (entities) that have been modified since a specific date.
 * Used for incremental backups.
 */
export async function getTablesWithChanges(since?: Date): Promise<string[]> {
  const where = since ? { createdAt: { gte: since } } : undefined;

  const logs = await db.auditLog.findMany({
    where,
    select: {
      entity: true,
    },
    distinct: ["entity"],
  });

  return logs.map((log) => log.entity);
}
