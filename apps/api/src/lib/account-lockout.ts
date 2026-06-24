import { db } from "@finanzas/db";
import { emitSecurityAlert } from "./security-alerts.ts";

// Per-user lockout policy:
//   - 5 consecutive failed login attempts → lock for 15 minutes
//   - On 10 cumulative failures → lock for 1 hour (escalation)
// Resets on any successful login. Adds defense beyond IP-based rate
// limiting (which doesn't protect against credential stuffing from
// distributed proxies targeting one user).

export const LOCKOUT_THRESHOLD_SHORT = 5;
export const LOCKOUT_THRESHOLD_LONG = 10;
export const LOCKOUT_DURATION_SHORT_MS: number = 15 * 60 * 1000;
export const LOCKOUT_DURATION_LONG_MS: number = 60 * 60 * 1000;

export function isLockedNow(user: { lockedUntil: Date | null }): boolean {
  return user.lockedUntil ? user.lockedUntil.getTime() > Date.now() : false;
}

export async function recordLoginFailure(userId: number): Promise<{
  attempts: number;
  lockedUntil: Date | null;
}> {
  const updated = await db.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });
  const attempts = updated.failedLoginAttempts;
  let lockUntil: Date | null = null;
  if (attempts >= LOCKOUT_THRESHOLD_LONG) {
    lockUntil = new Date(Date.now() + LOCKOUT_DURATION_LONG_MS);
  } else if (attempts >= LOCKOUT_THRESHOLD_SHORT) {
    lockUntil = new Date(Date.now() + LOCKOUT_DURATION_SHORT_MS);
  }
  if (lockUntil) {
    await db.user.update({
      where: { id: userId },
      data: { lockedUntil: lockUntil },
    });
    // Fire-and-forget: notify admins via Web Push that an account just
    // got locked. The dedupe table (security_alert_state) suppresses
    // bursts so a single account under sustained attack does not page
    // the operator more than once an hour. Long-threshold lockouts
    // promote to "critical" severity to differentiate sustained attacks
    // from a single fat-finger session.
    void emitSecurityAlert({
      scope: `user:${userId}`,
      alertType: attempts >= LOCKOUT_THRESHOLD_LONG ? "login_lockout_long" : "login_lockout_short",
      severity: attempts >= LOCKOUT_THRESHOLD_LONG ? "critical" : "warning",
      title: `Cuenta bloqueada (usuario ${userId})`,
      message:
        attempts >= LOCKOUT_THRESHOLD_LONG
          ? `${attempts} intentos fallidos consecutivos — bloqueo de 1 h aplicado.`
          : `${attempts} intentos fallidos consecutivos — bloqueo de 15 min aplicado.`,
      details: { userId, attempts, lockedUntil: lockUntil.toISOString() },
      url: `/admin/security/audit?userId=${userId}`,
    }).catch(() => undefined);
  }
  return { attempts, lockedUntil: lockUntil };
}

export async function recordLoginSuccess(userId: number, ip: string | null): Promise<void> {
  const now = new Date();
  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
      lastLoginIp: ip,
      lastActivityAt: now,
    },
  });
}
