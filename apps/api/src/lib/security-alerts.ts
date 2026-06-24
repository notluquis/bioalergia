import { db } from "@finanzas/db";
import { logEvent, logWarn } from "./logger.ts";
import { sendPushNotification } from "./notifications.ts";

// Security alert dispatcher with per-(scope, type) throttle. Wires
// audit-worthy events (LOGIN_LOCKED, repeated MFA failures, lockout
// escalations) to operator-visible channels (Web Push to admin
// users) while deduplicating bursts so the operator isn't drowned in
// alert noise when an attacker hammers a single account.
//
// Channel: Web Push (W3C / VAPID) to every user holding an admin
// role with a registered browser subscription. No Slack, no SMTP —
// per CLAUDE.local.md the clinic does not run Slack and there is no
// SMTP gateway wired. Web Push reaches the same operator on whatever
// device they last logged in from and is silent on the user's side
// when no subscription exists.
//
// Refs:
//   - NIST SP 800-53r5 IR-4(1) Automated Incident Handling
//   - NIST SP 800-53r5 AU-6(1) Automated Process Integration
//   - SOC 2 CC7.2 (system operations — incident detection)
//   - W3C Push API + VAPID (RFC 8292)
//
// The underlying event always lands in audit_logs regardless of
// whether the alert was throttled or delivered; this module's only
// responsibility is the operator-facing notification dedupe + fanout.

export type AlertSeverity = "info" | "warning" | "critical";

export type SecurityAlertInput = {
  /** Stable bucket for dedup. Examples: "user:42", "ip:1.2.3.4", "global". */
  scope: string;
  /** Family of alert; combined with scope for the dedup key. */
  alertType: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  /** Structured context appended to the alert payload. */
  details?: Record<string, unknown>;
  /** Override the default 1h throttle window for this alert family. */
  throttleMs?: number;
  /**
   * Optional deep-link the admin can click in the push notification.
   * Should be an intranet route, e.g. `/admin/security/audit?user=42`.
   */
  url?: string;
};

const DEFAULT_THROTTLE_MS = 60 * 60 * 1000;
const ADMIN_ROLE_NAMES = ["super_admin", "admin"];

async function withinThrottle(
  scope: string,
  alertType: string,
  windowMs: number
): Promise<boolean> {
  const existing = await db.securityAlertState.findUnique({
    where: { scope_alertType: { scope, alertType } },
  });
  if (!existing) return false;
  return Date.now() - existing.lastSentAt.getTime() < windowMs;
}

async function markSent(scope: string, alertType: string): Promise<void> {
  await db.securityAlertState.upsert({
    where: { scope_alertType: { scope, alertType } },
    create: { scope, alertType, lastSentAt: new Date() },
    update: { lastSentAt: new Date() },
  });
}

async function adminUserIdsWithPush(): Promise<number[]> {
  const rows = await db.user.findMany({
    where: {
      status: "ACTIVE",
      roles: { some: { role: { name: { in: ADMIN_ROLE_NAMES } } } },
      pushSubscriptions: { some: {} },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function fanoutPush(input: SecurityAlertInput, userIds: number[]): Promise<void> {
  const severityMark =
    input.severity === "critical" ? "🚨" : input.severity === "warning" ? "⚠️" : "ℹ️";
  await Promise.allSettled(
    userIds.map((userId) =>
      sendPushNotification(userId, {
        title: `${severityMark} ${input.title}`,
        body: input.message,
        url: input.url,
      })
    )
  );
}

export async function emitSecurityAlert(input: SecurityAlertInput): Promise<{
  delivered: boolean;
  reason?: string;
  recipients?: number;
}> {
  const window = input.throttleMs ?? DEFAULT_THROTTLE_MS;
  if (await withinThrottle(input.scope, input.alertType, window)) {
    return { delivered: false, reason: "throttled" };
  }
  // Best-effort: a delivery failure must not break the auth flow that
  // triggered the alert. Always update the dedupe state so a failing
  // push doesn't cause a tight retry loop on the next attempt.
  await markSent(input.scope, input.alertType);

  const userIds = await adminUserIdsWithPush();
  if (userIds.length === 0) {
    logWarn("[security-alerts] no admin user with push subscription", {
      scope: input.scope,
      alertType: input.alertType,
    });
    return { delivered: false, reason: "no_recipients" };
  }

  logEvent("[security-alerts] emitting", {
    scope: input.scope,
    alertType: input.alertType,
    severity: input.severity,
    title: input.title,
    recipients: userIds.length,
  });
  await fanoutPush(input, userIds);
  return { delivered: true, recipients: userIds.length };
}
