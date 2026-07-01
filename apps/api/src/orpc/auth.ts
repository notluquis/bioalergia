import type { AnyAbility, RawRuleOf } from "@casl/ability";
import { db } from "@finanzas/db";
import { sql } from "kysely";
import {
  authDebugScopeSchema,
  authEmptySchema,
  authExchangeDebugTokenResponseSchema,
  authExchangeDebugTokenSchema,
  authIssueDebugTokenResponseSchema,
  authIssueDebugTokenSchema,
  forgotPasswordResponseSchema,
  acceptInviteSchema,
  forgotPasswordSchema,
  resetPasswordTokenResponseSchema,
  resetPasswordTokenSchema,
  authLoginOkResponseSchema,
  authLoginResponseSchema,
  authLoginSchema,
  authMfaEnablePendingSchema,
  authMfaEnableSchema,
  authMfaLoginSchema,
  authMfaSetupPendingSchema,
  authMfaSetupResponseSchema,
  authPasskeyLoginOptionsSchema,
  authPasskeyRegisterPendingOptionsSchema,
  authPasskeyRegisterPendingVerifySchema,
  authPasskeyRegistrationOptionsSchema,
  authPasskeyResponseSchema,
  authPasskeyVerifySchema,
  authSessionResponseSchema,
  authStatusResponseSchema,
} from "@finanzas/orpc-contracts/auth";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { Context as HonoContext } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomUUID } from "node:crypto";
import { getSessionUser, hasPermission, resolveSessionUserFromToken } from "../lib/auth.ts";
import { isLockedNow, recordLoginFailure, recordLoginSuccess } from "../lib/account-lockout.ts";
import { ipFromContext, logAuditFromContext } from "../lib/audit-log.ts";
import { fakeVerifyPassword } from "../lib/crypto.ts";
import { DomainError } from "../lib/errors.ts";
import { logError, logEvent } from "../lib/logger.ts";
import {
  consumeInviteToken,
  requestPasswordReset,
  resetPasswordWithToken,
} from "../services/password-reset.ts";
import { rehashPassword, touchLastActivity } from "../services/auth-user.ts";
import {
  clearEmailLoginFailure,
  isEmailThrottled,
  recordEmailLoginFailure,
} from "../lib/login-throttle.ts";
import { signToken, verifyToken } from "../lib/paseto.ts";
import { getSetting } from "../lib/settings.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  consumeDebugTokenRecord,
  createDebugTokenRecord,
  ensureDebugTokenSupportEnabled,
} from "../services/debug-tokens.ts";
import { getAbilityRulesForUser } from "../lib/authz.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

const COOKIE_NAME = "finanzas_session";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 2,
  path: "/",
};

const RP_NAME = process.env.RP_NAME || "Finanzas App";
const RP_ID = process.env.RP_ID || "intranet.bioalergia.cl";
const ORIGIN = process.env.ORIGIN || "https://intranet.bioalergia.cl";

type AuthORPCContext = {
  hono: HonoContext;
};

type AuthSession = {
  email: string;
  roles: string[];
  sessionVersion: number;
  userId: number;
};

const base = os.$context<AuthORPCContext>();

const challengeStore = new Map<string, { challenge: string; expires: number; userId?: number }>();

function authError(
  status: "BAD_REQUEST" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | "UNAUTHORIZED",
  message: string
): never {
  throw new ORPCError(status, { message });
}

async function issueToken(session: AuthSession): Promise<string> {
  return issueTokenWithOptions(session);
}

async function issueTokenWithOptions(
  session: AuthSession,
  options?: {
    debugAudience?: string;
    debugReason?: string;
    debugScopes?: Array<{ action: string; subject: string }>;
    expiresIn?: string;
    tokenType?: "debug-session" | "session";
  }
): Promise<string> {
  return signToken(
    {
      aud: options?.debugAudience,
      sub: session.userId.toString(),
      email: session.email,
      reason: options?.debugReason,
      roles: session.roles,
      scp: options?.debugScopes,
      sv: session.sessionVersion,
      typ: options?.tokenType ?? "session",
    },
    options?.expiresIn ?? "2d"
  );
}

function normalizeEmailInput(value: string) {
  return value.toLowerCase().trim();
}

function storeChallenge(key: string, challenge: string, userId?: number): void {
  challengeStore.set(key, {
    challenge,
    expires: Date.now() + 5 * 60 * 1000,
    userId,
  });
}

function getChallenge(key: string): { challenge: string; userId?: number } | null {
  const entry = challengeStore.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expires) {
    challengeStore.delete(key);
    return null;
  }
  challengeStore.delete(key);
  return { challenge: entry.challenge, userId: entry.userId };
}

async function findUserByLoginIdentifier(email: string) {
  // login_email gana si no es vacío; si no, cae a person.email. Comparación
  // case-insensitive. Dentro del sql`` fragment las columnas son físicas (snake_case);
  // el builder (selectFrom/join/select) usa nombres de modelo camelCase.
  const row = await db.$qb
    .selectFrom("User as u")
    .innerJoin("Person as p", "p.id", "u.personId")
    .select(["u.id as id", "u.loginEmail as loginEmail", "p.email as notificationEmail"])
    .where(sql<boolean>`lower(coalesce(nullif(u.login_email, ''), p.email)) = lower(${email})`)
    .limit(1)
    .executeTakeFirst();

  return row ?? null;
}

async function getEffectiveLoginEmailByUserId(userId: number, fallbackEmail: string) {
  // login_email explícito gana; si no, el email de la persona; si no, el fallback.
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { loginEmail: true, person: { select: { email: true } } },
  });
  const explicitLoginEmail = row?.loginEmail?.trim();
  const notificationEmail = row?.person?.email?.trim();
  return explicitLoginEmail || notificationEmail || fallbackEmail;
}

type UserWithRoles = {
  id: number;
  mfaEnabled: boolean;
  mfaSecret: null | string;
  sessionVersion: number;
  status: string;
  person: { email: null | string; names: null | string } | null;
  roles: Array<{ role: { name: string } }>;
};

// Mint a real session cookie + return the ok-login payload. Shared by loginMfa,
// passkey login, and the MFA-enrollment completion endpoints so the
// session-issue tail lives in one place.
async function mintSessionResponse(context: AuthORPCContext, user: UserWithRoles) {
  const roles = user.roles.map((r) => r.role.name);
  const notificationEmail = user.person?.email ?? "";
  const loginEmail = await getEffectiveLoginEmailByUserId(user.id, notificationEmail);
  await recordLoginSuccess(user.id, ipFromContext(context.hono));
  clearEmailLoginFailure(loginEmail);
  const token = await issueToken({
    email: loginEmail,
    roles,
    sessionVersion: user.sessionVersion,
    userId: user.id,
  });
  setCookie(context.hono, COOKIE_NAME, token, COOKIE_OPTIONS);
  await touchLastActivity(user.id);
  const abilityRules = (await getAbilityRulesForUser(user.id)) as RawRuleOf<AnyAbility>[];
  return {
    abilityRules,
    status: "ok" as const,
    user: {
      email: loginEmail,
      id: user.id,
      loginEmail,
      mfaEnabled: user.mfaEnabled,
      name: user.person?.names || null,
      notificationEmail,
      roles,
      status: user.status,
    },
  };
}

// Validate a login-issued "mfa-setup" token and return the ACTIVE, still-
// MFA-less user it authorizes to enroll. Mirrors loginMfa's mfa-pending
// consumption. Rejects anything else — a bare userId can never enroll.
async function resolveMfaSetupToken(setupToken: string): Promise<UserWithRoles> {
  let setupUserId: number;
  try {
    const decoded = await verifyToken(setupToken);
    if (decoded.typ !== "mfa-setup" || typeof decoded.sub !== "number") {
      throw new Error("invalid mfa-setup token");
    }
    setupUserId = decoded.sub;
  } catch {
    authError("UNAUTHORIZED", "Sesión de configuración expirada. Inicia sesión nuevamente.");
  }

  const user = await db.user.findUnique({
    where: { id: setupUserId },
    include: { person: true, roles: { include: { role: true } } },
  });
  if (!user || user.status !== "ACTIVE" || user.mfaEnabled) {
    authError("BAD_REQUEST", "No se puede configurar MFA para esta cuenta.");
  }
  return user;
}

function getRequiredToken(context: AuthORPCContext) {
  const token = getCookie(context.hono, COOKIE_NAME);
  if (!token) {
    authError("UNAUTHORIZED", "No autorizado");
  }
  return token;
}

function toRecordExtensions(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function buildCookieOptions(maxAge: number) {
  return {
    ...COOKIE_OPTIONS,
    maxAge,
  };
}

function filterAbilityRulesByDebugScopes(
  abilityRules: RawRuleOf<AnyAbility>[],
  scopes?: Array<{ action: string; subject: string }>
) {
  if (!scopes || scopes.length === 0) {
    return abilityRules;
  }

  const allowed = new Set(scopes.map((scope) => `${scope.action}:${scope.subject}`));
  return abilityRules.filter((rule) => {
    if (typeof rule.action !== "string" || typeof rule.subject !== "string") {
      return false;
    }
    return allowed.has(`${rule.action}:${rule.subject}`);
  });
}

const debugTokenAdmin = base.use(async ({ context, next }) => {
  ensureDebugTokenSupportEnabled();
  const token = getRequiredToken(context);
  const session = await resolveSessionUserFromToken(token);
  if (!session) {
    authError("UNAUTHORIZED", "No autorizado");
  }

  // Golden-standard permission model:
  // issuing debug tokens should be gated by its own virtual subject instead of broad user mutation.
  // Keep update:User as a transitional fallback for existing admins until roles are migrated.
  const canIssue =
    (await hasPermission(session, "create", "DebugToken")) ||
    (await hasPermission(session, "update", "User"));
  if (!canIssue) {
    authError("FORBIDDEN", "Forbidden");
  }

  return next({ context: { ...context, session } });
});

const authORPCRouterBase = {
  login: base
    .route({ method: "POST", path: "/login", summary: "Login", tags: ["Auth"] })
    .input(authLoginSchema)
    .output(authLoginResponseSchema)
    .handler(async ({ context, input }) => {
      const normalizedEmail = normalizeEmailInput(input.email);

      // Per-email throttle covers the "user not found" path so an
      // attacker can't enumerate valid emails by observing which ones
      // eventually return 429-style errors. OWASP ASVS 5.0 V2.2.1 +
      // Authentication Cheat Sheet § Account Enumeration.
      const emailThrottle = isEmailThrottled(normalizedEmail);
      if (emailThrottle.blocked) {
        await logAuditFromContext(context.hono, {
          kind: "LOGIN_LOCKED",
          actorLabel: normalizedEmail,
          outcome: "denied",
          message: "email_throttled",
          metadata: { retryAfterMs: emailThrottle.retryAfterMs },
        });
        throw new DomainError(
          "RATE_LIMITED",
          "Demasiados intentos. Vuelve a intentarlo más tarde.",
          { retryAfterMs: emailThrottle.retryAfterMs }
        );
      }

      const loginCandidate = await findUserByLoginIdentifier(normalizedEmail);
      if (!loginCandidate) {
        // Constant-time path: still spend the argon2 verify budget so
        // "user not found" is timing-indistinguishable from "wrong
        // password". Increment the per-email counter so enumeration via
        // throttle response is also blocked.
        await fakeVerifyPassword(input.password);
        recordEmailLoginFailure(normalizedEmail);
        await logAuditFromContext(context.hono, {
          kind: "LOGIN_FAILURE",
          actorLabel: normalizedEmail,
          outcome: "denied",
          message: "user_not_found",
        });
        authError("UNAUTHORIZED", "Credenciales incorrectas");
      }

      const user = await db.user.findUnique({
        where: { id: loginCandidate.id },
        include: {
          person: true,
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        await fakeVerifyPassword(input.password);
        recordEmailLoginFailure(normalizedEmail);
        authError("UNAUTHORIZED", "Credenciales incorrectas");
      }

      // Per-user lockout (see lib/account-lockout.ts thresholds).
      if (isLockedNow(user)) {
        await logAuditFromContext(context.hono, {
          kind: "LOGIN_LOCKED",
          userId: user.id,
          actorLabel: normalizedEmail,
          outcome: "denied",
          message: `locked_until_${user.lockedUntil?.toISOString()}`,
        });
        authError("UNAUTHORIZED", "Cuenta bloqueada temporalmente. Intenta más tarde.");
      }

      if (!user.passwordHash) {
        await fakeVerifyPassword(input.password);
        recordEmailLoginFailure(normalizedEmail);
        authError("UNAUTHORIZED", "Credenciales incorrectas");
      }

      const { hashPassword, verifyPassword } = await import("../lib/crypto.ts");
      const { needsRehash, valid } = await verifyPassword(input.password, user.passwordHash);

      if (!valid) {
        const failure = await recordLoginFailure(user.id);
        recordEmailLoginFailure(normalizedEmail);
        await logAuditFromContext(context.hono, {
          kind: "LOGIN_FAILURE",
          userId: user.id,
          actorLabel: normalizedEmail,
          outcome: "denied",
          message: "bad_password",
          metadata: { attempts: failure.attempts, lockedUntil: failure.lockedUntil },
        });
        authError("UNAUTHORIZED", "Credenciales incorrectas");
      }

      if (needsRehash) {
        const newHash = await hashPassword(input.password);
        await rehashPassword(user.id, newHash);
      }

      if (user.mfaEnabled) {
        // Don't reset failure count yet — completion happens after MFA.
        // Issue an ephemeral proof that the password step succeeded; loginMfa
        // requires it so the first factor can't be skipped (OWASP ASVS 5.0
        // multi-step authentication).
        const mfaToken = await signToken({ typ: "mfa-pending", sub: user.id }, "5m");
        return { status: "mfa_required" as const, userId: user.id, mfaToken };
      }

      // Continuous MFA enforcement (opt-in via the auth.requireMfa setting; OFF
      // by default so this never mass-locks existing accounts). An ACTIVE
      // mfaEnforced user with no TOTP AND no passkey gets NO session — only a
      // short-lived mfa-setup token to enroll a factor, after which the *Pending
      // endpoints mint the real session. NOTE: gated on status === "ACTIVE" so
      // PENDING_SETUP invitees keep flowing to onboarding untouched.
      if (
        user.status === "ACTIVE" &&
        user.mfaEnforced &&
        (await getSetting("auth.requireMfa")) === "true"
      ) {
        const passkeyCount = await db.passkey.count({ where: { userId: user.id } });
        if (passkeyCount > 0) {
          // Owns a passkey but authenticated with a password — owning ≠ using.
          // Refuse the password session and force the phishing-resistant factor.
          authError("UNAUTHORIZED", "Tu cuenta usa passkey. Inicia sesión con tu passkey.");
        }
        clearEmailLoginFailure(normalizedEmail);
        await logAuditFromContext(context.hono, {
          kind: "LOGIN_SUCCESS",
          userId: user.id,
          actorLabel: normalizedEmail,
          message: "mfa_enrollment_required",
        });
        const setupToken = await signToken({ typ: "mfa-setup", sub: user.id }, "15m");
        return { status: "mfa_setup_required" as const, userId: user.id, setupToken };
      }

      await recordLoginSuccess(user.id, ipFromContext(context.hono));
      clearEmailLoginFailure(normalizedEmail);
      await logAuditFromContext(context.hono, {
        kind: "LOGIN_SUCCESS",
        userId: user.id,
        actorLabel: normalizedEmail,
      });

      const roles = user.roles.map((role: (typeof user.roles)[number]) => role.role.name);
      const notificationEmail = user.person?.email ?? normalizedEmail;
      const loginEmail =
        loginCandidate.loginEmail?.trim() ||
        loginCandidate.notificationEmail?.trim() ||
        normalizedEmail;

      const token = await issueToken({
        email: loginEmail,
        roles,
        sessionVersion: user.sessionVersion,
        userId: user.id,
      });
      setCookie(context.hono, COOKIE_NAME, token, COOKIE_OPTIONS);
      // Reset the inactivity clock at login (see touchLastActivity for the
      // >8h deadlock rationale this avoids).
      await touchLastActivity(user.id);

      const { getAbilityRulesForUser } = await import("../lib/authz.ts");
      const abilityRules = (await getAbilityRulesForUser(user.id)) as RawRuleOf<AnyAbility>[];

      return {
        abilityRules,
        status: "ok" as const,
        user: {
          email: loginEmail,
          id: user.id,
          loginEmail,
          mfaEnabled: user.mfaEnabled,
          name: user.person?.names || null,
          notificationEmail,
          roles,
          status: user.status,
        },
      };
    }),

  loginMfa: base
    .route({ method: "POST", path: "/login/mfa", summary: "Login with MFA", tags: ["Auth"] })
    .input(authMfaLoginSchema)
    .output(authLoginOkResponseSchema)
    .handler(async ({ context, input }) => {
      // First factor proof: the pending token issued by `login` after a
      // successful password check. Rejecting anything else means a bare
      // userId can never mint a session.
      let pendingUserId: number;
      try {
        const pending = await verifyToken(input.mfaToken);
        if (pending.typ !== "mfa-pending" || typeof pending.sub !== "number") {
          throw new Error("invalid mfa-pending token");
        }
        pendingUserId = pending.sub;
      } catch {
        authError("UNAUTHORIZED", "Sesión MFA expirada. Ingresa tu contraseña nuevamente.");
      }

      const user = await db.user.findUnique({
        where: { id: pendingUserId },
        include: {
          person: true,
          roles: { include: { role: true } },
        },
      });

      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        authError("BAD_REQUEST", "MFA no configurado");
      }

      const { verifyMfaToken, isTotpReplay, recordTotpAccepted } =
        await import("../services/mfa.ts");
      const { decryptSecret } = await import("../lib/secret-cipher.ts");
      const isValid =
        !isTotpReplay(user.id, input.token) &&
        (await verifyMfaToken(input.token, decryptSecret(user.mfaSecret) ?? ""));

      if (!isValid) {
        const failure = await recordLoginFailure(user.id);
        await logAuditFromContext(context.hono, {
          kind: "MFA_FAILURE",
          userId: user.id,
          outcome: "denied",
          metadata: { attempts: failure.attempts, lockedUntil: failure.lockedUntil },
        });
        authError("UNAUTHORIZED", "Código incorrecto");
      }

      recordTotpAccepted(user.id, input.token);
      await recordLoginSuccess(user.id, ipFromContext(context.hono));
      await logAuditFromContext(context.hono, {
        kind: "MFA_SUCCESS",
        userId: user.id,
      });

      const roles = user.roles.map((role: (typeof user.roles)[number]) => role.role.name);
      const notificationEmail = user.person?.email ?? "";
      const loginEmail = await getEffectiveLoginEmailByUserId(user.id, notificationEmail);
      // Clear the per-email throttle that may have accumulated entries
      // during the password phase before the user reached MFA.
      clearEmailLoginFailure(loginEmail);
      const token = await issueToken({
        email: loginEmail,
        roles,
        sessionVersion: user.sessionVersion,
        userId: user.id,
      });
      setCookie(context.hono, COOKIE_NAME, token, COOKIE_OPTIONS);
      // Reset the inactivity clock at login (see touchLastActivity for the
      // >8h deadlock rationale this avoids).
      await touchLastActivity(user.id);

      const { getAbilityRulesForUser } = await import("../lib/authz.ts");
      const abilityRules = (await getAbilityRulesForUser(user.id)) as RawRuleOf<AnyAbility>[];

      return {
        abilityRules,
        status: "ok" as const,
        user: {
          email: loginEmail,
          id: user.id,
          loginEmail,
          mfaEnabled: user.mfaEnabled,
          name: user.person?.names || null,
          notificationEmail,
          roles,
          status: user.status,
        },
      };
    }),

  forgotPassword: base
    .route({
      method: "POST",
      path: "/forgot-password",
      summary: "Request password reset",
      tags: ["Auth"],
    })
    .input(forgotPasswordSchema)
    .output(forgotPasswordResponseSchema)
    .handler(async ({ input }) => {
      // Anti-enumeration: ALWAYS return ok, even on internal failure (DB error,
      // etc.). Surfacing a non-200 here would let an attacker distinguish
      // existing vs unknown emails. requestPasswordReset already swallows email
      // send failures; this catch covers query/update throws.
      try {
        await requestPasswordReset(input.email);
      } catch (err) {
        logEvent("[password-reset] request failed (swallowed for anti-enumeration)", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return { status: "ok" as const };
    }),

  resetPassword: base
    .route({
      method: "POST",
      path: "/reset-password",
      summary: "Reset password with token",
      tags: ["Auth"],
    })
    .input(resetPasswordTokenSchema)
    .output(resetPasswordTokenResponseSchema)
    .handler(async ({ input }) => {
      await resetPasswordWithToken(input.token, input.password);
      return { status: "ok" as const };
    }),

  acceptInvite: base
    .route({
      method: "POST",
      path: "/accept-invite",
      summary: "Accept an admin invite and start an onboarding session",
      tags: ["Auth"],
    })
    .input(acceptInviteSchema)
    .output(authStatusResponseSchema)
    .handler(async ({ context, input }) => {
      // Consume the single-use invite token and mint a PENDING_SETUP session so
      // the invitee lands in the onboarding wizard (set password + profile +
      // bank + MFA). The _authed guard keeps them on /onboarding until setup.
      const session = await consumeInviteToken(input.token);
      const token = await issueToken({
        email: session.loginEmail,
        roles: session.roles,
        sessionVersion: session.sessionVersion,
        userId: session.userId,
      });
      setCookie(context.hono, COOKIE_NAME, token, COOKIE_OPTIONS);
      await touchLastActivity(session.userId);
      await logAuditFromContext(context.hono, {
        kind: "LOGIN_SUCCESS",
        userId: session.userId,
        actorLabel: session.loginEmail,
      });
      return { status: "ok" as const };
    }),

  logout: base
    .route({ method: "POST", path: "/logout", summary: "Logout", tags: ["Auth"] })
    .input(authEmptySchema)
    .output(authStatusResponseSchema)
    .handler(async ({ context }) => {
      // Wipe push subscriptions for this user — without this, the
      // operator's device keeps receiving WhatsApp message previews
      // (sender name + body snippet) on the lock screen after they
      // logged out. Ex-employee devices would also keep getting PHI.
      // We swallow the error so a transient DB hiccup doesn't block
      // the cookie deletion below.
      const session = await getSessionUser(context.hono);
      if (session) {
        await db.pushSubscription
          .deleteMany({ where: { userId: session.id } })
          .catch(() => undefined);
      }
      deleteCookie(context.hono, COOKIE_NAME);
      return { status: "ok" as const };
    }),

  session: base
    .route({ method: "GET", path: "/me/session", summary: "Get session", tags: ["Auth"] })
    .output(authSessionResponseSchema)
    .handler(async ({ context }) => {
      const hasCookieSession = Boolean(getCookie(context.hono, COOKIE_NAME));
      const session = await getSessionUser(context.hono);

      if (!session) {
        if (hasCookieSession) {
          deleteCookie(context.hono, COOKIE_NAME);
        }
        return { status: "ok" as const, user: null };
      }

      try {
        const user = await db.user.findUnique({
          where: { id: session.id },
          include: {
            passkeys: { select: { id: true } },
            person: true,
            roles: { include: { role: true } },
          },
        });

        if (!user) {
          if (hasCookieSession) {
            deleteCookie(context.hono, COOKIE_NAME);
          }
          return { status: "ok" as const, user: null };
        }

        const abilityRules = filterAbilityRulesByDebugScopes(
          (await getAbilityRulesForUser(user.id)) as RawRuleOf<AnyAbility>[],
          session.debugScopes
        );
        const notificationEmail = user.person?.email ?? "";
        const loginEmail = await getEffectiveLoginEmailByUserId(user.id, notificationEmail);

        return {
          abilityRules,
          permissionVersion: 1,
          status: "ok" as const,
          user: {
            email: loginEmail,
            hasPasskey: user.passkeys.length > 0,
            id: user.id,
            loginEmail,
            mfaEnabled: user.mfaEnabled,
            mfaEnforced: user.mfaEnforced,
            name: user.person?.names || null,
            notificationEmail,
            roles: user.roles.map((role: (typeof user.roles)[number]) => role.role.name),
            status: user.status,
          },
        };
      } catch {
        if (hasCookieSession) {
          deleteCookie(context.hono, COOKIE_NAME);
        }
        return { status: "ok" as const, user: null };
      }
    }),

  issueDebugToken: debugTokenAdmin
    .route({ method: "POST", path: "/debug/token", summary: "Issue debug token", tags: ["Auth"] })
    .input(authIssueDebugTokenSchema)
    .output(authIssueDebugTokenResponseSchema)
    .handler(async ({ context, input }) => {
      const targetUser = await db.user.findUnique({
        where: { id: input.targetUserId },
        include: {
          person: true,
          roles: { include: { role: true } },
        },
      });

      if (!targetUser || targetUser.status !== "ACTIVE") {
        authError("BAD_REQUEST", "Usuario objetivo no disponible");
      }

      const normalizedScopes = input.scopes.map((scope) => authDebugScopeSchema.parse(scope));
      const expiresInMinutes = input.expiresInMinutes ?? 10;
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      const jti = randomUUID();
      const notificationEmail = targetUser.person?.email ?? "";
      const loginEmail = await getEffectiveLoginEmailByUserId(targetUser.id, notificationEmail);

      await createDebugTokenRecord({
        audience: input.audience,
        expiresAt,
        issuedByUserId: context.session.id,
        jti,
        reason: input.reason,
        scopes: normalizedScopes,
        targetUserId: targetUser.id,
      });

      const token = await signToken(
        {
          actor: context.session.id,
          aud: input.audience,
          email: loginEmail,
          jti,
          reason: input.reason,
          scp: normalizedScopes,
          sub: targetUser.id.toString(),
          sv: targetUser.sessionVersion,
          typ: "debug",
        },
        `${expiresInMinutes}m`
      );

      return {
        expiresAt: expiresAt.toISOString(),
        jti,
        status: "ok" as const,
        token,
      };
    }),

  exchangeDebugToken: base
    .route({
      method: "POST",
      path: "/debug/exchange",
      summary: "Exchange debug token",
      tags: ["Auth"],
    })
    .input(authExchangeDebugTokenSchema)
    .output(authExchangeDebugTokenResponseSchema)
    .handler(async ({ context, input }) => {
      ensureDebugTokenSupportEnabled();
      const decoded = await verifyToken(input.token);
      if (!decoded || typeof decoded.sub !== "string" || typeof decoded.jti !== "string") {
        authError("UNAUTHORIZED", "Token inválido");
      }
      if (decoded.typ !== "debug") {
        authError("UNAUTHORIZED", "Token inválido");
      }

      const record = await consumeDebugTokenRecord(decoded.jti);
      if (!record) {
        authError("UNAUTHORIZED", "Token expirado o ya utilizado");
      }

      const targetUser = await db.user.findUnique({
        where: { id: record.targetUserId },
        include: {
          person: true,
          roles: { include: { role: true } },
        },
      });

      if (!targetUser || targetUser.status !== "ACTIVE") {
        authError("UNAUTHORIZED", "Usuario objetivo no disponible");
      }

      const notificationEmail = targetUser.person?.email ?? "";
      const loginEmail = await getEffectiveLoginEmailByUserId(targetUser.id, notificationEmail);
      const accessToken = await issueTokenWithOptions(
        {
          email: loginEmail,
          roles: targetUser.roles.map((role: (typeof targetUser.roles)[number]) => role.role.name),
          sessionVersion: targetUser.sessionVersion,
          userId: targetUser.id,
        },
        {
          debugAudience: record.audience,
          debugReason: record.reason,
          debugScopes: record.scopes,
          expiresIn: "10m",
          tokenType: "debug-session",
        }
      );

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const delivery = input.delivery ?? "bearer";

      if (delivery === "cookie") {
        setCookie(context.hono, COOKIE_NAME, accessToken, buildCookieOptions(10 * 60));
      }

      return {
        ...(delivery === "bearer" ? { accessToken } : {}),
        delivery,
        expiresAt,
        status: "ok" as const,
        user: {
          email: loginEmail,
          id: targetUser.id,
          loginEmail,
          mfaEnabled: targetUser.mfaEnabled,
          name: targetUser.person?.names || null,
          notificationEmail,
          roles: targetUser.roles.map((role: (typeof targetUser.roles)[number]) => role.role.name),
          status: targetUser.status,
        },
      };
    }),

  mfaDisable: base
    .route({ method: "POST", path: "/mfa/disable", summary: "Disable MFA", tags: ["Auth"] })
    .input(authEmptySchema)
    .output(authStatusResponseSchema)
    .handler(async ({ context }) => {
      const token = getRequiredToken(context);
      const session = await resolveSessionUserFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      await db.user.update({
        where: { id: session.id },
        data: { mfaEnabled: false, mfaSecret: null },
      });

      return { status: "ok" as const };
    }),

  mfaEnable: base
    .route({ method: "POST", path: "/mfa/enable", summary: "Enable MFA", tags: ["Auth"] })
    .input(authMfaEnableSchema)
    .output(authStatusResponseSchema)
    .handler(async ({ context, input }) => {
      const token = getRequiredToken(context);
      const session = await resolveSessionUserFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      const user = await db.user.findUnique({ where: { id: session.id } });
      if (!user) {
        authError("BAD_REQUEST", "Usuario no encontrado");
      }

      if (!user.mfaSecret) {
        authError("BAD_REQUEST", "MFA setup no iniciado");
      }

      const { verifyMfaToken } = await import("../services/mfa.ts");
      const { decryptSecret } = await import("../lib/secret-cipher.ts");
      const isValid = await verifyMfaToken(input.token, decryptSecret(user.mfaSecret) ?? "");
      if (!isValid) {
        authError("BAD_REQUEST", "Código incorrecto");
      }

      await db.user.update({
        where: { id: session.id },
        data: { mfaEnabled: true },
      });

      return { status: "ok" as const };
    }),

  mfaSetup: base
    .route({ method: "POST", path: "/mfa/setup", summary: "Setup MFA", tags: ["Auth"] })
    .input(authEmptySchema)
    .output(authMfaSetupResponseSchema)
    .handler(async ({ context }) => {
      const token = getRequiredToken(context);
      const session = await resolveSessionUserFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      const { generateMfaSecret } = await import("../services/mfa.ts");
      const { qrCodeUrl, secret } = await generateMfaSecret(session.email);

      // mfaSecret is sensitive (allows OTP forgery if leaked) — encrypt
      // at rest with the same WA_SECRET_KEY/rotation infrastructure
      // used for Meta secrets. Verify path decrypts before TOTP check.
      const { encryptSecret } = await import("../lib/secret-cipher.ts");
      await db.user.update({
        where: { id: session.id },
        data: { mfaEnabled: false, mfaSecret: encryptSecret(secret) },
      });

      return {
        qrCodeUrl,
        secret,
        status: "ok" as const,
      };
    }),

  passkeyLoginOptions: base
    .route({
      method: "GET",
      path: "/passkey/login/options",
      summary: "Get passkey login options",
      tags: ["Auth"],
    })
    .output(authPasskeyLoginOptionsSchema)
    .handler(async () => {
      const { generateAuthenticationOptions } = await import("@simplewebauthn/server");

      const options = await generateAuthenticationOptions({
        allowCredentials: [],
        rpID: RP_ID,
        // PHI app: the authenticator must verify the human (PIN/biometric),
        // not just be present. Pairs with requireUserVerification below.
        userVerification: "required",
      });

      storeChallenge(`login:${options.challenge}`, options.challenge);
      return {
        allowCredentials:
          options.allowCredentials?.map((credential) => ({
            id: credential.id,
            transports: credential.transports,
            type: credential.type,
          })) ?? [],
        challenge: options.challenge,
        extensions: toRecordExtensions(options.extensions),
        rpId: options.rpId,
        timeout: options.timeout,
        userVerification: options.userVerification,
      };
    }),

  passkeyLoginVerify: base
    .route({
      method: "POST",
      path: "/passkey/login/verify",
      summary: "Verify passkey login",
      tags: ["Auth"],
    })
    .input(authPasskeyVerifySchema)
    .output(authLoginOkResponseSchema)
    .handler(async ({ context, input }) => {
      const storedChallenge = getChallenge(`login:${input.challenge}`);
      if (!storedChallenge) {
        authError("BAD_REQUEST", "Challenge inválido o expirado");
      }

      const responseBody = input.body as unknown as AuthenticationResponseJSON;
      const credentialID = responseBody.id;

      const passkey = await db.passkey.findUnique({
        where: { credentialId: credentialID },
        include: {
          user: {
            include: {
              person: true,
              roles: { include: { role: true } },
            },
          },
        },
      });

      if (!passkey?.user) {
        authError("UNAUTHORIZED", "Credencial no encontrada");
      }

      let verification;
      try {
        verification = await import("@simplewebauthn/server").then(
          ({ verifyAuthenticationResponse }) =>
            verifyAuthenticationResponse({
              credential: {
                counter: Number(passkey.counter),
                id: passkey.credentialId,
                publicKey: new Uint8Array(passkey.publicKey),
                transports:
                  (passkey.transports as AuthenticatorTransportFuture[] | null) || undefined,
              },
              expectedChallenge: input.challenge,
              expectedOrigin: ORIGIN,
              expectedRPID: RP_ID,
              requireUserVerification: true,
              response: responseBody,
            })
        );
      } catch (err) {
        authError("UNAUTHORIZED", err instanceof Error ? err.message : "Verificación fallida");
      }

      if (!verification.verified) {
        authError("UNAUTHORIZED", "Verificación fallida");
      }

      await db.passkey.update({
        where: { id: passkey.id },
        data: {
          counter: BigInt(verification.authenticationInfo.newCounter),
          lastUsedAt: new Date(),
        },
      });

      const user = passkey.user;
      const roles = user.roles.map((role: (typeof user.roles)[number]) => role.role.name);
      const notificationEmail = user.person?.email ?? "";
      const loginEmail = await getEffectiveLoginEmailByUserId(user.id, notificationEmail);
      const token = await issueToken({
        email: loginEmail,
        roles,
        sessionVersion: user.sessionVersion,
        userId: user.id,
      });
      setCookie(context.hono, COOKIE_NAME, token, COOKIE_OPTIONS);
      // Reset the inactivity clock at login (see touchLastActivity for the
      // >8h deadlock rationale this avoids).
      await touchLastActivity(user.id);

      const { getAbilityRulesForUser } = await import("../lib/authz.ts");
      const abilityRules = (await getAbilityRulesForUser(user.id)) as RawRuleOf<AnyAbility>[];

      return {
        abilityRules,
        status: "ok" as const,
        user: {
          email: loginEmail,
          id: user.id,
          loginEmail,
          mfaEnabled: user.mfaEnabled,
          name: user.person?.names || null,
          notificationEmail,
          roles,
          status: user.status,
        },
      };
    }),

  passkeyRegisterOptions: base
    .route({
      method: "GET",
      path: "/passkey/register/options",
      summary: "Get passkey register options",
      tags: ["Auth"],
    })
    .output(authPasskeyRegistrationOptionsSchema)
    .handler(async ({ context }) => {
      const token = getRequiredToken(context);
      const session = await resolveSessionUserFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      const user = await db.user.findUnique({
        where: { id: session.id },
        include: { person: true },
      });
      if (!user) {
        authError("BAD_REQUEST", "Usuario no encontrado");
      }

      const { generateRegistrationOptions } = await import("@simplewebauthn/server");
      const options = await generateRegistrationOptions({
        attestationType: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "required",
          userVerification: "required",
        },
        rpID: RP_ID,
        rpName: RP_NAME,
        userDisplayName: user.person?.names || user.person?.email || session.email,
        userID: new Uint8Array(Buffer.from(String(session.id))),
        userName: user.person?.email || session.email,
      });

      storeChallenge(`register:${options.challenge}`, options.challenge, session.id);
      return {
        attestation: options.attestation,
        authenticatorSelection: options.authenticatorSelection,
        challenge: options.challenge,
        excludeCredentials: options.excludeCredentials?.map((credential) => ({
          id: credential.id,
          transports: credential.transports,
          type: credential.type,
        })),
        extensions: toRecordExtensions(options.extensions),
        pubKeyCredParams: options.pubKeyCredParams.map((param) => ({
          alg: param.alg,
          type: param.type,
        })),
        rp: {
          id: options.rp.id,
          name: options.rp.name,
        },
        timeout: options.timeout,
        user: {
          displayName: options.user.displayName,
          id: options.user.id,
          name: options.user.name,
        },
      };
    }),

  passkeyRegisterVerify: base
    .route({
      method: "POST",
      path: "/passkey/register/verify",
      summary: "Verify passkey registration",
      tags: ["Auth"],
    })
    .input(authPasskeyResponseSchema)
    .output(authStatusResponseSchema)
    .handler(async ({ context, input }) => {
      const sessionToken = getRequiredToken(context);
      const session = await resolveSessionUserFromToken(sessionToken);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      const storedChallenge = getChallenge(`register:${input.challenge}`);
      if (!storedChallenge || storedChallenge.userId !== session.id) {
        authError("BAD_REQUEST", "Challenge inválido");
      }

      const responseBody = input.body as unknown as RegistrationResponseJSON;
      let verification;
      try {
        const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
        verification = await verifyRegistrationResponse({
          expectedChallenge: input.challenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          response: responseBody,
        });
      } catch (err) {
        authError("BAD_REQUEST", err instanceof Error ? err.message : "Verificación fallida");
      }

      if (!verification.verified || !verification.registrationInfo) {
        authError("BAD_REQUEST", "Verificación fallida");
      }

      const { credential, credentialBackedUp, credentialDeviceType } =
        verification.registrationInfo;

      await db.passkey.create({
        data: {
          backedUp: credentialBackedUp,
          counter: BigInt(credential.counter),
          credentialId: credential.id,
          deviceType: credentialDeviceType,
          friendlyName: `Passkey (${new Date().toLocaleDateString()})`,
          publicKey: Buffer.from(credential.publicKey),
          transports: responseBody.response.transports ?? undefined,
          userId: session.id,
          webAuthnUserID: String(session.id),
        },
      });

      return {
        message: "Passkey registrado exitosamente",
        status: "ok" as const,
      };
    }),

  // ── MFA-enrollment endpoints (login mfa-setup token, NOT a session cookie) ──
  mfaSetupPending: base
    .route({ method: "POST", path: "/mfa/setup/pending", summary: "Setup MFA (enrollment)", tags: ["Auth"] })
    .input(authMfaSetupPendingSchema)
    .output(authMfaSetupResponseSchema)
    .handler(async ({ input }) => {
      const user = await resolveMfaSetupToken(input.setupToken);
      const email = user.person?.email ?? String(user.id);
      const { generateMfaSecret } = await import("../services/mfa.ts");
      const { qrCodeUrl, secret } = await generateMfaSecret(email);
      const { encryptSecret } = await import("../lib/secret-cipher.ts");
      await db.user.update({
        where: { id: user.id },
        data: { mfaEnabled: false, mfaSecret: encryptSecret(secret) },
      });
      return { qrCodeUrl, secret, status: "ok" as const };
    }),

  mfaEnablePending: base
    .route({
      method: "POST",
      path: "/mfa/enable/pending",
      summary: "Enable MFA (enrollment) and start the session",
      tags: ["Auth"],
    })
    .input(authMfaEnablePendingSchema)
    .output(authLoginOkResponseSchema)
    .handler(async ({ context, input }) => {
      const user = await resolveMfaSetupToken(input.setupToken);
      if (!user.mfaSecret) {
        authError("BAD_REQUEST", "MFA setup no iniciado");
      }
      const { verifyMfaToken } = await import("../services/mfa.ts");
      const { decryptSecret } = await import("../lib/secret-cipher.ts");
      const isValid = await verifyMfaToken(input.token, decryptSecret(user.mfaSecret) ?? "");
      if (!isValid) {
        authError("BAD_REQUEST", "Código incorrecto");
      }
      await db.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
      await logAuditFromContext(context.hono, { kind: "MFA_SUCCESS", userId: user.id });
      // Session minted only AFTER mfaEnabled is persisted.
      return mintSessionResponse(context, { ...user, mfaEnabled: true });
    }),

  passkeyRegisterOptionsPending: base
    .route({
      method: "POST",
      path: "/passkey/register/options/pending",
      summary: "Passkey register options (enrollment)",
      tags: ["Auth"],
    })
    .input(authPasskeyRegisterPendingOptionsSchema)
    .output(authPasskeyRegistrationOptionsSchema)
    .handler(async ({ input }) => {
      const user = await resolveMfaSetupToken(input.setupToken);
      const email = user.person?.email ?? String(user.id);
      const { generateRegistrationOptions } = await import("@simplewebauthn/server");
      const options = await generateRegistrationOptions({
        attestationType: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "required",
          userVerification: "required",
        },
        rpID: RP_ID,
        rpName: RP_NAME,
        userDisplayName: user.person?.names || email,
        userID: new Uint8Array(Buffer.from(String(user.id))),
        userName: email,
      });

      storeChallenge(`register:${options.challenge}`, options.challenge, user.id);
      return {
        attestation: options.attestation,
        authenticatorSelection: options.authenticatorSelection,
        challenge: options.challenge,
        excludeCredentials: options.excludeCredentials?.map((credential) => ({
          id: credential.id,
          transports: credential.transports,
          type: credential.type,
        })),
        extensions: toRecordExtensions(options.extensions),
        pubKeyCredParams: options.pubKeyCredParams.map((param) => ({
          alg: param.alg,
          type: param.type,
        })),
        rp: { id: options.rp.id, name: options.rp.name },
        timeout: options.timeout,
        user: {
          displayName: options.user.displayName,
          id: options.user.id,
          name: options.user.name,
        },
      };
    }),

  passkeyRegisterVerifyPending: base
    .route({
      method: "POST",
      path: "/passkey/register/verify/pending",
      summary: "Verify passkey registration (enrollment) and start the session",
      tags: ["Auth"],
    })
    .input(authPasskeyRegisterPendingVerifySchema)
    .output(authLoginOkResponseSchema)
    .handler(async ({ context, input }) => {
      const user = await resolveMfaSetupToken(input.setupToken);
      const storedChallenge = getChallenge(`register:${input.challenge}`);
      if (!storedChallenge || storedChallenge.userId !== user.id) {
        authError("BAD_REQUEST", "Challenge inválido");
      }

      const responseBody = input.body as unknown as RegistrationResponseJSON;
      let verification;
      try {
        const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
        verification = await verifyRegistrationResponse({
          expectedChallenge: input.challenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          response: responseBody,
        });
      } catch (err) {
        authError("BAD_REQUEST", err instanceof Error ? err.message : "Verificación fallida");
      }

      if (!verification.verified || !verification.registrationInfo) {
        authError("BAD_REQUEST", "Verificación fallida");
      }

      const { credential, credentialBackedUp, credentialDeviceType } =
        verification.registrationInfo;

      await db.passkey.create({
        data: {
          backedUp: credentialBackedUp,
          counter: BigInt(credential.counter),
          credentialId: credential.id,
          deviceType: credentialDeviceType,
          friendlyName: `Passkey (${new Date().toLocaleDateString()})`,
          publicKey: Buffer.from(credential.publicKey),
          transports: responseBody.response.transports ?? undefined,
          userId: user.id,
          webAuthnUserID: String(user.id),
        },
      });
      await logAuditFromContext(context.hono, { kind: "MFA_SUCCESS", userId: user.id });
      // Session minted only AFTER the passkey row is persisted.
      return mintSessionResponse(context, user);
    }),

  passkeyRemove: base
    .route({
      method: "DELETE",
      path: "/passkey/remove",
      summary: "Remove passkeys",
      tags: ["Auth"],
    })
    .input(authEmptySchema)
    .output(authStatusResponseSchema)
    .handler(async ({ context }) => {
      const token = getRequiredToken(context);
      const session = await resolveSessionUserFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      await db.passkey.deleteMany({
        where: { userId: session.id },
      });

      return {
        message: "Passkey eliminado",
        status: "ok" as const,
      };
    }),
};

export const authORPCRouter = base.prefix("/api/orpc/auth").router(authORPCRouterBase);

export const authORPCHandler = new SuperJSONRPCHandler(authORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.auth",
      });
    }),
  ],
});

export const authOpenAPIHandler = new OpenAPIHandler(authORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Auth oRPC",
          description: "Contratos oRPC/OpenAPI para login, sesión, MFA y passkeys.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.auth",
      });
    }),
  ],
});

export type AuthORPCRouter = typeof authORPCRouter;
