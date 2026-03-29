import type { AnyAbility, RawRuleOf } from "@casl/ability";
import { db } from "@finanzas/db";
import {
  authDebugScopeSchema,
  authEmptySchema,
  authExchangeDebugTokenResponseSchema,
  authExchangeDebugTokenSchema,
  authIssueDebugTokenResponseSchema,
  authIssueDebugTokenSchema,
  authLoginOkResponseSchema,
  authLoginResponseSchema,
  authLoginSchema,
  authMfaEnableSchema,
  authMfaLoginSchema,
  authMfaSetupResponseSchema,
  authPasskeyLoginOptionsSchema,
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
import { getSessionUser, hasPermission, resolveSessionUserFromToken } from "../auth";
import { logError } from "../lib/logger";
import { signToken, verifyToken } from "../lib/paseto";
import { configureSuperjson } from "../lib/superjson-config";
import {
  consumeDebugTokenRecord,
  createDebugTokenRecord,
  ensureDebugTokenSupportEnabled,
} from "../services/debug-tokens";
import { getAbilityRulesForUser } from "../services/authz";
import { SuperJSONRPCHandler } from "./superjson";

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
  message: string,
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
  },
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
    options?.expiresIn ?? "2d",
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
  const rows = await db.$queryRaw<
    Array<{ id: number; loginEmail: null | string; notificationEmail: null | string }>
  >`
    SELECT
      u.id AS "id",
      u.login_email AS "loginEmail",
      p.email AS "notificationEmail"
    FROM users u
    JOIN people p ON p.id = u.person_id
    WHERE lower(coalesce(nullif(u.login_email, ''), p.email)) = lower(${email})
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function getEffectiveLoginEmailByUserId(userId: number, fallbackEmail: string) {
  const rows = await db.$queryRaw<
    Array<{ loginEmail: null | string; notificationEmail: null | string }>
  >`
    SELECT
      u.login_email AS "loginEmail",
      p.email AS "notificationEmail"
    FROM users u
    JOIN people p ON p.id = u.person_id
    WHERE u.id = ${userId}
    LIMIT 1
  `;

  const row = rows[0];
  const explicitLoginEmail = row?.loginEmail?.trim();
  const notificationEmail = row?.notificationEmail?.trim();
  return explicitLoginEmail || notificationEmail || fallbackEmail;
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
  scopes?: Array<{ action: string; subject: string }>,
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
      const loginCandidate = await findUserByLoginIdentifier(normalizedEmail);
      if (!loginCandidate) {
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
        authError("UNAUTHORIZED", "Credenciales incorrectas");
      }

      if (!user.passwordHash) {
        authError("UNAUTHORIZED", "Credenciales incorrectas");
      }

      const { hashPassword, verifyPassword } = await import("../lib/crypto.js");
      const { needsRehash, valid } = await verifyPassword(input.password, user.passwordHash);

      if (!valid) {
        authError("UNAUTHORIZED", "Credenciales incorrectas");
      }

      if (needsRehash) {
        const newHash = await hashPassword(input.password);
        await db.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
      }

      if (user.mfaEnabled) {
        return { status: "mfa_required" as const, userId: user.id };
      }

      const roles = user.roles.map((role) => role.role.name);
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

      const { getAbilityRulesForUser } = await import("../services/authz.js");
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
      const user = await db.user.findUnique({
        where: { id: input.userId },
        include: {
          person: true,
          roles: { include: { role: true } },
        },
      });

      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        authError("BAD_REQUEST", "MFA no configurado");
      }

      const { verifyMfaToken } = await import("../services/mfa.js");
      const isValid = await verifyMfaToken(input.token, user.mfaSecret);

      if (!isValid) {
        authError("UNAUTHORIZED", "Código incorrecto");
      }

      const roles = user.roles.map((role) => role.role.name);
      const notificationEmail = user.person?.email ?? "";
      const loginEmail = await getEffectiveLoginEmailByUserId(user.id, notificationEmail);
      const token = await issueToken({
        email: loginEmail,
        roles,
        sessionVersion: user.sessionVersion,
        userId: user.id,
      });
      setCookie(context.hono, COOKIE_NAME, token, COOKIE_OPTIONS);

      const { getAbilityRulesForUser } = await import("../services/authz.js");
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

  logout: base
    .route({ method: "POST", path: "/logout", summary: "Logout", tags: ["Auth"] })
    .input(authEmptySchema)
    .output(authStatusResponseSchema)
    .handler(async ({ context }) => {
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
          session.debugScopes,
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
            roles: user.roles.map((role) => role.role.name),
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
        `${expiresInMinutes}m`,
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
          roles: targetUser.roles.map((role) => role.role.name),
          sessionVersion: targetUser.sessionVersion,
          userId: targetUser.id,
        },
        {
          debugAudience: record.audience,
          debugReason: record.reason,
          debugScopes: record.scopes,
          expiresIn: "10m",
          tokenType: "debug-session",
        },
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
          roles: targetUser.roles.map((role) => role.role.name),
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

      const { verifyMfaToken } = await import("../services/mfa.js");
      const isValid = await verifyMfaToken(input.token, user.mfaSecret);
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

      const { generateMfaSecret } = await import("../services/mfa.js");
      const { qrCodeUrl, secret } = await generateMfaSecret(session.email);

      await db.user.update({
        where: { id: session.id },
        data: { mfaEnabled: false, mfaSecret: secret },
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
        userVerification: "preferred",
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
              requireUserVerification: false,
              response: responseBody,
            }),
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
      const roles = user.roles.map((role) => role.role.name);
      const notificationEmail = user.person?.email ?? "";
      const loginEmail = await getEffectiveLoginEmailByUserId(user.id, notificationEmail);
      const token = await issueToken({
        email: loginEmail,
        roles,
        sessionVersion: user.sessionVersion,
        userId: user.id,
      });
      setCookie(context.hono, COOKIE_NAME, token, COOKIE_OPTIONS);

      const { getAbilityRulesForUser } = await import("../services/authz.js");
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
          userVerification: "preferred",
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
      const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
      const verification = await verifyRegistrationResponse({
        expectedChallenge: input.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        response: responseBody,
      });

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
