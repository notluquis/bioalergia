import { createHash, randomBytes } from "node:crypto";
import { db } from "@finanzas/db";
import { hashPassword } from "../lib/crypto.ts";
import { DomainError } from "../lib/errors.ts";
import { logEvent } from "../lib/logger.ts";
import { loadSettings } from "../lib/settings.ts";
import { sendAccountInviteEmail, sendPasswordResetLinkEmail } from "./email/transactional.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// Token validity is admin-configurable via the DB settings (auth.inviteTtlDays /
// auth.passwordResetTtlMinutes); DEFAULT_SETTINGS supplies 7 days / 60 minutes
// when unset. Positive integers only — a bad value falls back to the default.
function positiveIntSetting(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Admin invite: mint a set-password token for a freshly created PENDING_SETUP
 * user and email the activation link. TTL comes from settings (auth.inviteTtlDays).
 * Returns whether provisioning succeeded (admin falls back to a manual resend if
 * not). Never throws — the user is already created, so a DB/mail hiccup here must
 * not fail the invite.
 */
export async function sendAccountInvite(args: {
  userId: number;
  to: string;
  name: string;
}): Promise<boolean> {
  try {
    const { authInviteTtlDays } = await loadSettings();
    const ttlDays = positiveIntSetting(authInviteTtlDays, 7);
    const token = randomBytes(32).toString("hex");
    await db.user.update({
      where: { id: args.userId },
      data: {
        passwordResetTokenHash: sha256(token),
        passwordResetExpiresAt: new Date(Date.now() + ttlDays * DAY_MS),
        passwordResetPurpose: "invite",
      },
    });
    await sendAccountInviteEmail({ to: args.to, name: args.name, token, ttlDays });
    logEvent("[invite] set-password link sent", { userId: args.userId });
    return true;
  } catch {
    logEvent("[invite] set-password provisioning failed", { userId: args.userId });
    return false;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Self-service forgot-password. Looks up the user by login email OR linked
 * person email, mints a one-time token (stores only its hash), and emails the
 * reset link. ALWAYS resolves without revealing whether the email exists
 * (anti-enumeration) — callers return a generic 200 regardless.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return;

  const user = await db.user.findFirst({
    where: {
      OR: [
        { loginEmail: { equals: email, mode: "insensitive" as const } },
        { person: { email: { equals: email, mode: "insensitive" as const } } },
      ],
    },
    select: { id: true, person: { select: { email: true, names: true } } },
  });

  // Send target is the linked person email (the verified contact address).
  const to = user?.person?.email;
  if (!user || !to) {
    logEvent("[password-reset] request for unknown/emailless account", {});
    return; // silent — no enumeration
  }

  const { authPasswordResetTtlMinutes } = await loadSettings();
  const ttlMinutes = positiveIntSetting(authPasswordResetTtlMinutes, 60);
  const token = randomBytes(32).toString("hex");
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: sha256(token),
      passwordResetExpiresAt: new Date(Date.now() + ttlMinutes * MINUTE_MS),
      // A forgot-password token must never activate an account. Clear any stale
      // "invite" purpose so completion can't flip status (see resetPasswordWithToken).
      passwordResetPurpose: null,
    },
  });

  try {
    await sendPasswordResetLinkEmail({ to, name: user.person?.names ?? "", token, ttlMinutes });
    logEvent("[password-reset] link sent", { userId: user.id });
  } catch {
    // Don't leak send failures to the caller (still generic 200). Logged in the
    // email layer.
  }
}

/**
 * Accept an admin invite: validate the emailed token (hash + purpose "invite" +
 * not expired) for a still-PENDING_SETUP account, consume it (single-use), and
 * return the data needed to mint an onboarding session. The caller (auth router)
 * sets the session cookie so the invitee lands directly in the onboarding
 * wizard, where they set their password + profile + bank + MFA. Requiring
 * purpose "invite" prevents a forgot-password token from logging anyone in.
 */
export async function consumeInviteToken(token: string): Promise<{
  userId: number;
  loginEmail: string;
  roles: string[];
  sessionVersion: number;
}> {
  const tokenHash = sha256(token.trim());
  const user = await db.user.findFirst({
    where: { passwordResetTokenHash: tokenHash, passwordResetPurpose: "invite" },
    select: {
      id: true,
      status: true,
      sessionVersion: true,
      loginEmail: true,
      passwordResetExpiresAt: true,
      person: { select: { email: true } },
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  if (
    !user ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt < new Date() ||
    user.status !== "PENDING_SETUP"
  ) {
    throw new DomainError("BAD_REQUEST", "La invitación es inválida o expiró. Pide una nueva.", {});
  }

  // Atomic single-use consume: the WHERE still matches the token hash + purpose,
  // so under a race (double-click / concurrent link use) only the first update
  // clears it — the rest see count 0 and are rejected. A bare update-by-id would
  // let two racers both mint a session.
  const consumed = await db.user.updateMany({
    where: {
      id: user.id,
      passwordResetTokenHash: tokenHash,
      passwordResetPurpose: "invite",
    },
    data: {
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      passwordResetPurpose: null,
    },
  });
  if (consumed.count === 0) {
    throw new DomainError("BAD_REQUEST", "La invitación ya fue utilizada. Pide una nueva.", {});
  }
  logEvent("[invite] accepted → onboarding session", { userId: user.id });

  const loginEmail = user.loginEmail?.trim() || user.person?.email?.trim() || "";
  return {
    userId: user.id,
    loginEmail,
    roles: user.roles.map((r: { role: { name: string } }) => r.role.name),
    sessionVersion: user.sessionVersion,
  };
}

/**
 * Complete the reset: validates the token (hash match + not expired), sets the
 * new password, clears the token, and bumps sessionVersion to kill any existing
 * sessions. Throws BAD_REQUEST on an invalid/expired token.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const tokenHash = sha256(token.trim());
  const user = await db.user.findFirst({
    where: { passwordResetTokenHash: tokenHash },
    select: { id: true, passwordResetExpiresAt: true },
  });

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    throw new DomainError("BAD_REQUEST", "El enlace es inválido o expiró. Solicita uno nuevo.", {});
  }

  // NOTE: never touch `status` here. Forgot-password must not activate a
  // PENDING_SETUP account nor unsuspend a SUSPENDED one. Invited users onboard
  // via the wizard (see consumeInviteToken), not this path.
  const passwordHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      passwordResetPurpose: null,
      sessionVersion: { increment: 1 },
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  logEvent("[password-reset] password changed via token", { userId: user.id });
}
