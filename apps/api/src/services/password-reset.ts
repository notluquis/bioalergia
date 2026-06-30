import { createHash, randomBytes } from "node:crypto";
import { db } from "@finanzas/db";
import { hashPassword } from "../lib/crypto.ts";
import { DomainError } from "../lib/errors.ts";
import { logEvent } from "../lib/logger.ts";
import { sendAccountInviteEmail, sendPasswordResetLinkEmail } from "./email/transactional.ts";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Admin invite: mint a long-lived (7-day) set-password token for a freshly
 * created PENDING_SETUP user and email a "define tu contraseña" link. Reuses
 * the same token columns + /reset-password page as forgot-password. Returns
 * whether the email actually went out (admin falls back to a manual reset if
 * not). Never throws — invite creation must not roll back on a mail outage.
 */
export async function sendAccountInvite(args: {
  userId: number;
  to: string;
  name: string;
}): Promise<boolean> {
  const token = randomBytes(32).toString("hex");
  await db.user.update({
    where: { id: args.userId },
    data: {
      passwordResetTokenHash: sha256(token),
      passwordResetExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
      passwordResetPurpose: "invite",
    },
  });
  try {
    await sendAccountInviteEmail({ to: args.to, name: args.name, token });
    logEvent("[invite] set-password link sent", { userId: args.userId });
    return true;
  } catch {
    logEvent("[invite] set-password email failed", { userId: args.userId });
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

  const token = randomBytes(32).toString("hex");
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: sha256(token),
      passwordResetExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      // A forgot-password token must never activate an account. Clear any stale
      // "invite" purpose so completion can't flip status (see resetPasswordWithToken).
      passwordResetPurpose: null,
    },
  });

  try {
    await sendPasswordResetLinkEmail({ to, name: user.person?.names ?? "", token });
    logEvent("[password-reset] link sent", { userId: user.id });
  } catch {
    // Don't leak send failures to the caller (still generic 200). Logged in the
    // email layer.
  }
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
    select: { id: true, status: true, passwordResetExpiresAt: true, passwordResetPurpose: true },
  });

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    throw new DomainError("BAD_REQUEST", "El enlace es inválido o expiró. Solicita uno nuevo.", {});
  }

  // Activate ONLY when this token was minted by an admin invite AND the account
  // is still PENDING_SETUP. A forgot-password token (purpose null/"reset") never
  // changes status, so an account put back into onboarding can't bypass the
  // wizard via self-service reset; SUSPENDED/ACTIVE are likewise untouched.
  const activate = user.passwordResetPurpose === "invite" && user.status === "PENDING_SETUP";
  const passwordHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      ...(activate ? { status: "ACTIVE" as const } : {}),
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
