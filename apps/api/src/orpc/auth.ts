import type { RawRuleOf } from "@casl/ability";
import { db } from "@finanzas/db";
import {
  authEmptySchema,
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
  authUserSchema,
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
import { logError } from "../lib/logger";
import { signToken, verifyToken } from "../lib/paseto";
import { configureSuperjson } from "../lib/superjson-config";
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
  return signToken(
    {
      sub: session.userId.toString(),
      email: session.email,
      roles: session.roles,
      sv: session.sessionVersion,
    },
    "2d",
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

async function resolveSessionFromToken(token: string) {
  const decoded = await verifyToken(token);
  if (!decoded || typeof decoded.sub !== "string") {
    return null;
  }
  const userId = Number(decoded.sub);
  if (!Number.isFinite(userId)) {
    return null;
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, sessionVersion: true, person: { select: { email: true } } },
  });
  if (!user) {
    return null;
  }
  const tokenSessionVersion =
    typeof decoded.sv === "number" && Number.isFinite(decoded.sv) ? decoded.sv : 1;
  if (tokenSessionVersion !== user.sessionVersion) {
    return null;
  }
  return {
    userEmail: await getEffectiveLoginEmailByUserId(
      user.id,
      user.person?.email ?? String(decoded.email ?? ""),
    ),
    userId: user.id,
  };
}

function getRequiredToken(context: AuthORPCContext) {
  const token = getCookie(context.hono, COOKIE_NAME);
  if (!token) {
    authError("UNAUTHORIZED", "No autorizado");
  }
  return token;
}

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
      const abilityRules = (await getAbilityRulesForUser(user.id)) as RawRuleOf<any>[];

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
      const abilityRules = (await getAbilityRulesForUser(user.id)) as RawRuleOf<any>[];

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
      const token = getCookie(context.hono, COOKIE_NAME);
      if (!token) {
        return { status: "ok" as const, user: null };
      }

      try {
        const session = await resolveSessionFromToken(token);
        if (!session) {
          deleteCookie(context.hono, COOKIE_NAME);
          return { status: "ok" as const, user: null };
        }

        const user = await db.user.findUnique({
          where: { id: session.userId },
          include: {
            passkeys: { select: { id: true } },
            person: true,
            roles: { include: { role: true } },
          },
        });

        if (!user) {
          deleteCookie(context.hono, COOKIE_NAME);
          return { status: "ok" as const, user: null };
        }

        const { getAbilityRulesForUser } = await import("../services/authz.js");
        const abilityRules = (await getAbilityRulesForUser(user.id)) as RawRuleOf<any>[];
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
        deleteCookie(context.hono, COOKIE_NAME);
        return { status: "ok" as const, user: null };
      }
    }),

  mfaDisable: base
    .route({ method: "POST", path: "/mfa/disable", summary: "Disable MFA", tags: ["Auth"] })
    .input(authEmptySchema)
    .output(authStatusResponseSchema)
    .handler(async ({ context }) => {
      const token = getRequiredToken(context);
      const session = await resolveSessionFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      await db.user.update({
        where: { id: session.userId },
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
      const session = await resolveSessionFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      const user = await db.user.findUnique({ where: { id: session.userId } });
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
        where: { id: session.userId },
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
      const session = await resolveSessionFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      const { generateMfaSecret } = await import("../services/mfa.js");
      const { qrCodeUrl, secret } = await generateMfaSecret(session.userEmail);

      await db.user.update({
        where: { id: session.userId },
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
      return options;
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

      const verification = await import("@simplewebauthn/server").then(
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
            response: responseBody,
          }),
      );

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
      const abilityRules = (await getAbilityRulesForUser(user.id)) as RawRuleOf<any>[];

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
      const session = await resolveSessionFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      const user = await db.user.findUnique({
        where: { id: session.userId },
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
        userDisplayName: user.person?.names || user.person?.email || session.userEmail,
        userID: new Uint8Array(Buffer.from(String(session.userId))),
        userName: user.person?.email || session.userEmail,
      });

      storeChallenge(`register:${options.challenge}`, options.challenge, session.userId);
      return options;
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
      const session = await resolveSessionFromToken(sessionToken);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      const storedChallenge = getChallenge(`register:${input.challenge}`);
      if (!storedChallenge || storedChallenge.userId !== session.userId) {
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
          userId: session.userId,
          webAuthnUserID: String(session.userId),
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
      const session = await resolveSessionFromToken(token);
      if (!session) {
        authError("UNAUTHORIZED", "Token inválido");
      }

      await db.passkey.deleteMany({
        where: { userId: session.userId },
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
