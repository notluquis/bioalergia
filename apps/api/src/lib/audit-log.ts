import { db } from "@finanzas/db";
import type { Context } from "hono";
import { clientIp } from "./client-ip.ts";
import { logWarn } from "./logger.ts";

// Append-only audit trail. Best-effort: a DB failure here must NEVER
// break the calling auth/business flow. We swallow + warn so that an
// audit outage doesn't lock anyone out.

export type AuditEventKind =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGIN_LOCKED"
  | "MFA_SUCCESS"
  | "MFA_FAILURE"
  | "PASSWORD_CHANGE"
  | "PASSWORD_RESET"
  | "MFA_ENROLL"
  | "MFA_DISABLE"
  | "PASSKEY_REGISTER"
  | "PASSKEY_DELETE"
  | "ROLE_GRANT"
  | "ROLE_REVOKE"
  | "USER_CREATE"
  | "USER_DEACTIVATE"
  | "USER_REACTIVATE"
  | "DATA_EXPORT"
  | "ADMIN_ACTION"
  | "WA_CONTACT_BLOCK"
  | "WA_CONTACT_UNBLOCK"
  | "SETTINGS_UPDATE"
  | "OTHER";

export type AuditInput = {
  kind: AuditEventKind;
  userId?: number | null;
  actorLabel?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  resource?: string | null;
  resourceId?: string | number | null;
  outcome?: "ok" | "denied" | "error";
  message?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const ipFromContext = clientIp;

export async function logAuditEvent(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        kind: input.kind as never,
        userId: input.userId ?? null,
        actorLabel: input.actorLabel ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        resource: input.resource ?? null,
        resourceId: input.resourceId == null ? null : String(input.resourceId),
        outcome: input.outcome ?? "ok",
        message: input.message ?? null,
        // ZenStack v3 / Prisma reject a raw `null` literal on a JSON
        // column — it expects the typed `JsonNull` sentinel. Simplest
        // safe path: omit the key entirely when there is no metadata, so
        // the column falls back to its DB default. Passing `null` here
        // was throwing `Invalid input ... at "data.metadata"` on EVERY
        // login (caught + warned, but the audit row was silently lost).
        ...(input.metadata == null ? {} : { metadata: input.metadata as never }),
      },
    });
  } catch (err) {
    logWarn("[audit] persist failed", {
      error: err instanceof Error ? err.message : String(err),
      kind: input.kind,
    });
  }
}

// Convenience: extract ip + UA from Hono context in one call.
export async function logAuditFromContext(c: Context, input: AuditInput): Promise<void> {
  await logAuditEvent({
    ...input,
    ip: input.ip ?? ipFromContext(c),
    userAgent: input.userAgent ?? c.req.header("user-agent") ?? null,
  });
}
