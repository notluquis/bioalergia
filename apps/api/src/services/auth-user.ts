import { db } from "@finanzas/db";

// Pure DB-plumbing helpers shared by the auth handlers. These carry NO
// security decisions (no throttle/lockout/verify/MFA branching) — they are
// mechanical persistence steps that were duplicated across the intranet
// login, loginMfa and passkey-login paths. The orchestration (which factor
// ran, whether to issue a cookie, audit logging) stays in the handlers.

/**
 * Stamp `lastActivityAt = now` for a freshly-issued session.
 *
 * Why this exists / must run at login: `resolveSessionUserFromToken` rejects
 * sessions idle > INACTIVITY_THRESHOLD_MS (8h) and only touches
 * lastActivityAt AFTER passing that gate — so a user returning after >8h
 * would be locked out: the freshly-issued token is valid, but the stale
 * lastActivityAt from the previous session nulls it before it can be
 * refreshed (deadlock). Stamping it at login starts the new session clean.
 */
export async function touchLastActivity(userId: number): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { lastActivityAt: new Date() } });
}

/**
 * Persist a transparently re-computed password hash when argon2.needsRehash
 * flags a legacy parameter set. Called only after a SUCCESSFUL verify, with a
 * hash the handler already computed — no verification happens here.
 */
export async function rehashPassword(userId: number, passwordHash: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
}
