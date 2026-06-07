import { createHash, randomBytes } from "node:crypto";
import { db } from "@finanzas/db";
import { hashPassword } from "../lib/crypto.ts";
import { DomainError } from "../lib/errors.ts";
import { logEvent } from "../lib/logger.ts";
import { sendPasswordResetLinkEmail } from "./email/transactional.ts";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

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
    select: { id: true, passwordResetExpiresAt: true },
  });

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    throw new DomainError("BAD_REQUEST", "El enlace es inválido o expiró. Solicita uno nuevo.", {});
  }

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      // NOTE: do NOT touch `status` here — a self-service reset must not
      // unsuspend a SUSPENDED account. Only credentials + lockout are reset.
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      sessionVersion: { increment: 1 },
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  logEvent("[password-reset] password changed via token", { userId: user.id });
}
