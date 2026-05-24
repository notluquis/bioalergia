import { db } from "@finanzas/db";
import {
  siteAuthConsumeMagicLinkInputSchema,
  siteAuthLoginPasswordInputSchema,
  siteAuthLoginResponseSchema,
  siteAuthMagicLinkStatusSchema,
  siteAuthPasskeyDeleteInputSchema,
  siteAuthPasskeyListResponseSchema,
  siteAuthPasskeyLoginVerifyInputSchema,
  siteAuthPasskeyOptionsResponseSchema,
  siteAuthPasskeyVerifyInputSchema,
  siteAuthRegisterPasswordInputSchema,
  siteAuthRequestMagicLinkInputSchema,
  siteAuthSessionResponseSchema,
  siteAuthSetPasswordInputSchema,
  siteAuthStatusResponseSchema,
} from "@finanzas/orpc-contracts/site-auth";
import { ORPCError, onError, os } from "@orpc/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { createHash, randomBytes } from "node:crypto";
import type { Context as HonoContext } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { getSiteSessionUser, SITE_COOKIE_NAME } from "../lib/auth.ts";
import { hashPassword, verifyPassword } from "../lib/crypto.ts";
import { logError } from "../lib/logger.ts";
import { signToken } from "../lib/paseto.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { CART_COOKIE_NAME, findCartByToken } from "../services/cart.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

const SHOP_RP_ID = process.env.SHOP_RP_ID || "bioalergia.cl";
const SHOP_RP_NAME = process.env.SHOP_RP_NAME || "Bioalergia";
const SHOP_ORIGIN = process.env.SHOP_ORIGIN || "https://bioalergia.cl";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days for shop sessions
  path: "/",
};

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SHOP_CUSTOMER_ROLE = "ShopCustomer";

type SiteAuthContext = { hono: HonoContext };
const base = os.$context<SiteAuthContext>();

// In-memory challenge store for WebAuthn (process-local; OK for now while
// we run a single api instance — same pattern as intranet auth.ts).
const challengeStore = new Map<
  string,
  { challenge: string; expires: number; userId?: number }
>();

function storeChallenge(key: string, challenge: string, userId?: number): void {
  challengeStore.set(key, {
    challenge,
    expires: Date.now() + 5 * 60 * 1000,
    userId,
  });
}

function consumeChallenge(key: string): { challenge: string; userId?: number } | null {
  const entry = challengeStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    challengeStore.delete(key);
    return null;
  }
  challengeStore.delete(key);
  return { challenge: entry.challenge, userId: entry.userId };
}

function authError(
  status: "BAD_REQUEST" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | "UNAUTHORIZED",
  message: string
): never {
  throw new ORPCError(status, { message });
}

function normalizeEmail(value: string): string {
  return value.toLowerCase().trim();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function ensureShopCustomerRoleId(): Promise<number | null> {
  const role = await db.role.findUnique({ where: { name: SHOP_CUSTOMER_ROLE } });
  return role?.id ?? null;
}

async function ensureUserHasShopCustomerRole(userId: number): Promise<void> {
  const roleId = await ensureShopCustomerRoleId();
  if (!roleId) return; // Seed migration hasn't run yet; non-fatal.
  const existing = await db.userRoleAssignment.findFirst({
    where: { userId, roleId },
  });
  if (existing) return;
  await db.userRoleAssignment.create({ data: { userId, roleId } });
}

async function findUserByEmail(email: string) {
  // Match by Person.email (notification) OR User.loginEmail (explicit).
  const rows = await db.$queryRaw<Array<{ id: number }>>`
    SELECT u.id
    FROM users u
    JOIN people p ON p.id = u.person_id
    WHERE lower(coalesce(nullif(u.login_email, ''), p.email)) = lower(${email})
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return db.user.findUnique({
    where: { id: rows[0].id },
    include: {
      person: true,
      passkeys: { select: { id: true } },
      roles: { include: { role: true } },
    },
  });
}

async function issueSiteToken(opts: {
  userId: number;
  email: string;
  sessionVersion: number;
  roles: string[];
}): Promise<string> {
  return signToken(
    {
      sub: String(opts.userId),
      email: opts.email,
      roles: opts.roles,
      sv: opts.sessionVersion,
      typ: "session",
    },
    "30d"
  );
}

async function mergeAnonymousCartIntoUser(hono: HonoContext, userId: number): Promise<void> {
  const cartToken = getCookie(hono, CART_COOKIE_NAME);
  if (!cartToken) return;
  const cart = await findCartByToken(cartToken);
  if (!cart) return;
  if (cart.userId === userId) return;
  if (cart.userId === null) {
    await db.cart.update({ where: { id: cart.id }, data: { userId } });
  }
}

type UserWithRelations = NonNullable<Awaited<ReturnType<typeof findUserByEmail>>>;

function buildSiteUser(user: UserWithRelations) {
  return {
    id: user.id,
    email: user.loginEmail ?? user.person?.email ?? "",
    name: user.person?.names ?? null,
    has_password: Boolean(user.passwordHash),
    passkey_count: user.passkeys.length,
    mfa_enabled: user.mfaEnabled,
  };
}

async function setSiteSessionCookieAndIssue(hono: HonoContext, user: UserWithRelations) {
  await ensureUserHasShopCustomerRole(user.id);
  const roles = user.roles.map(
    (assignment: (typeof user.roles)[number]) => assignment.role.name
  );
  const email = user.loginEmail ?? user.person?.email ?? "";
  const token = await issueSiteToken({
    userId: user.id,
    email,
    sessionVersion: user.sessionVersion,
    roles,
  });
  setCookie(hono, SITE_COOKIE_NAME, token, COOKIE_OPTIONS);
  await mergeAnonymousCartIntoUser(hono, user.id);
}

const siteAuthRouterBase = {
  requestMagicLink: base
    .route({ method: "POST", path: "/magic-link/request", tags: ["SiteAuth"] })
    .input(siteAuthRequestMagicLinkInputSchema)
    .output(siteAuthMagicLinkStatusSchema)
    .handler(async ({ input }) => {
      const email = normalizeEmail(input.email);
      const existing = await findUserByEmail(email);
      let user = existing;
      if (!user) {
        // Create Person + User shell. User.status = ACTIVE so they can
        // navigate /mi-cuenta immediately on link click; password remains
        // null until they explicitly add one from /mi-cuenta/seguridad.
        const personInput = {
          email,
          names: input.name ?? email.split("@")[0],
        };
        const created = await db.user.create({
          data: {
            loginEmail: email,
            status: "ACTIVE",
            mfaEnforced: false,
            person: {
              create: personInput,
            },
          },
          include: {
            person: true,
            passkeys: { select: { id: true } },
            roles: { include: { role: true } },
          },
        });
        user = created;
      }

      const token = randomBytes(32).toString("base64url");
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
      await db.magicLinkToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      // TODO: replace console.log with Resend (or chosen transactional ESP)
      // — for now we surface the link in api logs so the operator can
      // verify the flow end-to-end before SMTP credentials land.
      const url = `${SHOP_ORIGIN}/mi-cuenta/auth/callback?token=${encodeURIComponent(token)}`;
      // eslint-disable-next-line no-console
      console.log(`[site-auth] Magic link for ${email}: ${url}`);

      return { status: "ok" as const };
    }),

  consumeMagicLink: base
    .route({ method: "POST", path: "/magic-link/consume", tags: ["SiteAuth"] })
    .input(siteAuthConsumeMagicLinkInputSchema)
    .output(siteAuthLoginResponseSchema)
    .handler(async ({ context, input }) => {
      const tokenHash = hashToken(input.token);
      const record = await db.magicLinkToken.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              person: true,
              passkeys: { select: { id: true } },
              roles: { include: { role: true } },
            },
          },
        },
      });
      if (!record || record.consumedAt || record.expiresAt < new Date()) {
        authError("UNAUTHORIZED", "Enlace inválido o expirado");
      }
      await db.magicLinkToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      const user = record.user;
      if (!user || user.status === "SUSPENDED") {
        authError("UNAUTHORIZED", "Cuenta no disponible");
      }
      await setSiteSessionCookieAndIssue(context.hono, user);
      return { status: "ok" as const, user: buildSiteUser(user) };
    }),

  loginWithPassword: base
    .route({ method: "POST", path: "/login", tags: ["SiteAuth"] })
    .input(siteAuthLoginPasswordInputSchema)
    .output(siteAuthLoginResponseSchema)
    .handler(async ({ context, input }) => {
      const email = normalizeEmail(input.email);
      const user = await findUserByEmail(email);
      if (!user || !user.passwordHash) {
        authError("UNAUTHORIZED", "Credenciales incorrectas");
      }
      const { valid } = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        authError("UNAUTHORIZED", "Credenciales incorrectas");
      }
      if (user.status === "SUSPENDED") {
        authError("UNAUTHORIZED", "Cuenta no disponible");
      }
      await setSiteSessionCookieAndIssue(context.hono, user);
      return { status: "ok" as const, user: buildSiteUser(user) };
    }),

  registerWithPassword: base
    .route({ method: "POST", path: "/register", tags: ["SiteAuth"] })
    .input(siteAuthRegisterPasswordInputSchema)
    .output(siteAuthLoginResponseSchema)
    .handler(async ({ context, input }) => {
      const email = normalizeEmail(input.email);
      const existing = await findUserByEmail(email);
      if (existing) {
        if (existing.passwordHash) {
          authError("BAD_REQUEST", "Ya existe una cuenta con ese email");
        }
        // Upgrade in place — preexisting Person/User (e.g. magic-link
        // shell or patient surface) acquires a password.
        const passwordHash = await hashPassword(input.password);
        const updated = await db.user.update({
          where: { id: existing.id },
          data: { passwordHash, status: "ACTIVE" },
          include: {
            person: true,
            passkeys: { select: { id: true } },
            roles: { include: { role: true } },
          },
        });
        if (input.rut && existing.person && !existing.person.rut) {
          await db.person
            .update({ where: { id: existing.person.id }, data: { rut: input.rut } })
            .catch(() => undefined);
        }
        await setSiteSessionCookieAndIssue(context.hono, updated);
        return { status: "ok" as const, user: buildSiteUser(updated) };
      }
      const passwordHash = await hashPassword(input.password);
      const created = await db.user.create({
        data: {
          loginEmail: email,
          passwordHash,
          status: "ACTIVE",
          mfaEnforced: false,
          person: {
            create: {
              email,
              names: input.name,
              ...(input.rut ? { rut: input.rut } : {}),
            },
          },
        },
        include: {
          person: true,
          passkeys: { select: { id: true } },
          roles: { include: { role: true } },
        },
      });
      await setSiteSessionCookieAndIssue(context.hono, created);
      return { status: "ok" as const, user: buildSiteUser(created) };
    }),

  logout: base
    .route({ method: "POST", path: "/logout", tags: ["SiteAuth"] })
    .output(siteAuthStatusResponseSchema)
    .handler(async ({ context }) => {
      const session = await getSiteSessionUser(context.hono);
      if (session) {
        // Bump sessionVersion so any still-living PASETO with old sv fails.
        await db.user
          .update({
            where: { id: session.id },
            data: { sessionVersion: { increment: 1 } },
          })
          .catch(() => undefined);
      }
      deleteCookie(context.hono, SITE_COOKIE_NAME, { path: "/" });
      return { status: "ok" as const };
    }),

  me: base
    .route({ method: "GET", path: "/me", tags: ["SiteAuth"] })
    .output(siteAuthSessionResponseSchema)
    .handler(async ({ context }) => {
      const session = await getSiteSessionUser(context.hono);
      if (!session) {
        return { status: "ok" as const, user: null };
      }
      const user = await db.user.findUnique({
        where: { id: session.id },
        include: {
          person: true,
          passkeys: { select: { id: true } },
          roles: { include: { role: true } },
        },
      });
      if (!user) {
        return { status: "ok" as const, user: null };
      }
      return { status: "ok" as const, user: buildSiteUser(user) };
    }),

  setPassword: base
    .route({ method: "POST", path: "/set-password", tags: ["SiteAuth"] })
    .input(siteAuthSetPasswordInputSchema)
    .output(siteAuthStatusResponseSchema)
    .handler(async ({ context, input }) => {
      const session = await getSiteSessionUser(context.hono);
      if (!session) authError("UNAUTHORIZED", "No autorizado");
      const user = await db.user.findUnique({ where: { id: session.id } });
      if (!user) authError("UNAUTHORIZED", "Usuario no encontrado");
      if (user.passwordHash) {
        if (!input.currentPassword) {
          authError("BAD_REQUEST", "Contraseña actual requerida");
        }
        const { valid } = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!valid) authError("UNAUTHORIZED", "Contraseña actual incorrecta");
      }
      const newHash = await hashPassword(input.newPassword);
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, sessionVersion: { increment: 1 } },
      });
      // Re-issue cookie with bumped sv so the current device stays logged in.
      const refreshed = await db.user.findUnique({
        where: { id: user.id },
        include: {
          person: true,
          passkeys: { select: { id: true } },
          roles: { include: { role: true } },
        },
      });
      if (refreshed) {
        await setSiteSessionCookieAndIssue(context.hono, refreshed);
      }
      return { status: "ok" as const };
    }),

  passkeyRegisterOptions: base
    .route({ method: "GET", path: "/passkey/register/options", tags: ["SiteAuth"] })
    .output(siteAuthPasskeyOptionsResponseSchema)
    .handler(async ({ context }) => {
      const session = await getSiteSessionUser(context.hono);
      if (!session) authError("UNAUTHORIZED", "No autorizado");
      const user = await db.user.findUnique({
        where: { id: session.id },
        include: { person: true },
      });
      if (!user) authError("UNAUTHORIZED", "Usuario no encontrado");
      const { generateRegistrationOptions } = await import("@simplewebauthn/server");
      const options = await generateRegistrationOptions({
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
        rpID: SHOP_RP_ID,
        rpName: SHOP_RP_NAME,
        userDisplayName: user.person?.names || session.email,
        userID: new Uint8Array(Buffer.from(String(session.id))),
        userName: session.email,
      });
      storeChallenge(`site:register:${options.challenge}`, options.challenge, session.id);
      return { status: "ok" as const, options };
    }),

  passkeyRegisterVerify: base
    .route({ method: "POST", path: "/passkey/register/verify", tags: ["SiteAuth"] })
    .input(siteAuthPasskeyVerifyInputSchema)
    .output(siteAuthStatusResponseSchema)
    .handler(async ({ context, input }) => {
      const session = await getSiteSessionUser(context.hono);
      if (!session) authError("UNAUTHORIZED", "No autorizado");
      const stored = consumeChallenge(`site:register:${input.challenge}`);
      if (!stored || stored.userId !== session.id) {
        authError("BAD_REQUEST", "Challenge inválido");
      }
      const responseBody = input.body as unknown as RegistrationResponseJSON;
      const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
      const verification = await verifyRegistrationResponse({
        expectedChallenge: input.challenge,
        expectedOrigin: SHOP_ORIGIN,
        expectedRPID: SHOP_RP_ID,
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
          friendlyName:
            input.friendlyName ?? `Passkey (${new Date().toLocaleDateString("es-CL")})`,
          publicKey: Buffer.from(credential.publicKey),
          transports: responseBody.response.transports ?? undefined,
          userId: session.id,
          webAuthnUserID: String(session.id),
        },
      });
      return { status: "ok" as const };
    }),

  passkeyLoginOptions: base
    .route({ method: "GET", path: "/passkey/login/options", tags: ["SiteAuth"] })
    .output(siteAuthPasskeyOptionsResponseSchema)
    .handler(async () => {
      const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
      const options = await generateAuthenticationOptions({
        allowCredentials: [],
        rpID: SHOP_RP_ID,
        userVerification: "preferred",
      });
      storeChallenge(`site:login:${options.challenge}`, options.challenge);
      return { status: "ok" as const, options };
    }),

  passkeyLoginVerify: base
    .route({ method: "POST", path: "/passkey/login/verify", tags: ["SiteAuth"] })
    .input(siteAuthPasskeyLoginVerifyInputSchema)
    .output(siteAuthLoginResponseSchema)
    .handler(async ({ context, input }) => {
      const stored = consumeChallenge(`site:login:${input.challenge}`);
      if (!stored) authError("BAD_REQUEST", "Challenge inválido");
      const responseBody = input.body as unknown as AuthenticationResponseJSON;
      const passkey = await db.passkey.findUnique({
        where: { credentialId: responseBody.id },
        include: {
          user: {
            include: {
              person: true,
              passkeys: { select: { id: true } },
              roles: { include: { role: true } },
            },
          },
        },
      });
      if (!passkey?.user) authError("UNAUTHORIZED", "Credencial no encontrada");
      const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
      const verification = await verifyAuthenticationResponse({
        credential: {
          counter: Number(passkey.counter),
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          transports:
            (passkey.transports as AuthenticatorTransportFuture[] | null) || undefined,
        },
        expectedChallenge: input.challenge,
        expectedOrigin: SHOP_ORIGIN,
        expectedRPID: SHOP_RP_ID,
        requireUserVerification: false,
        response: responseBody,
      });
      if (!verification.verified) authError("UNAUTHORIZED", "Verificación fallida");
      await db.passkey.update({
        where: { id: passkey.id },
        data: {
          counter: BigInt(verification.authenticationInfo.newCounter),
          lastUsedAt: new Date(),
        },
      });
      await setSiteSessionCookieAndIssue(context.hono, passkey.user);
      return { status: "ok" as const, user: buildSiteUser(passkey.user) };
    }),

  passkeyList: base
    .route({ method: "GET", path: "/passkey/list", tags: ["SiteAuth"] })
    .output(siteAuthPasskeyListResponseSchema)
    .handler(async ({ context }) => {
      const session = await getSiteSessionUser(context.hono);
      if (!session) authError("UNAUTHORIZED", "No autorizado");
      const rows = await db.passkey.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
      });
      return {
        status: "ok" as const,
        data: rows.map((row: (typeof rows)[number]) => ({
          id: row.id,
          friendly_name: row.friendlyName,
          created_at: row.createdAt.toISOString(),
          last_used_at: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
        })),
      };
    }),

  passkeyDelete: base
    .route({ method: "POST", path: "/passkey/delete", tags: ["SiteAuth"] })
    .input(siteAuthPasskeyDeleteInputSchema)
    .output(siteAuthStatusResponseSchema)
    .handler(async ({ context, input }) => {
      const session = await getSiteSessionUser(context.hono);
      if (!session) authError("UNAUTHORIZED", "No autorizado");
      await db.passkey.deleteMany({
        where: { id: input.passkey_id, userId: session.id },
      });
      return { status: "ok" as const };
    }),
};

export const siteAuthORPCRouter = base
  .prefix("/api/orpc/site-auth")
  .tag("SiteAuth")
  .router(siteAuthRouterBase);

export const siteAuthORPCHandler = new SuperJSONRPCHandler(siteAuthORPCRouter, {
  interceptors: [onError((error) => logError("site-auth.orpc.rpc", error, {}))],
});

export type SiteAuthORPCRouter = typeof siteAuthORPCRouter;
