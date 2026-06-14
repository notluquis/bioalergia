import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Characterization tests pinning the CURRENT security behavior of the public
// shop auth handlers (apps/api/src/orpc/site-auth.ts). These were recently
// hardened (per-email throttle, constant-time fakeVerify, per-user lockout,
// magic-link by email that NEVER logs the link). No prior coverage.

const {
  mockDb,
  mockUserFindUnique,
  mockUserCreate,
  mockUserUpdate,
  mockQueryRaw,
  mockRoleFindUnique,
  mockUraFindFirst,
  mockUraCreate,
  mockMagicFindUnique,
  mockMagicCreate,
  mockMagicUpdate,
  mockCartUpdate,
} = vi.hoisted(() => {
  const mk = () => vi.fn();
  const mockUserFindUnique = mk();
  const mockUserCreate = mk();
  const mockUserUpdate = mk().mockResolvedValue({});
  const mockQueryRaw = mk();
  const mockRoleFindUnique = mk().mockResolvedValue({ id: 99 });
  const mockUraFindFirst = mk().mockResolvedValue({ id: 1 });
  const mockUraCreate = mk().mockResolvedValue({});
  const mockMagicFindUnique = mk();
  const mockMagicCreate = mk().mockResolvedValue({});
  const mockMagicUpdate = mk().mockResolvedValue({});
  const mockCartUpdate = mk().mockResolvedValue({});
  const mockDb = {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      create: (...a: unknown[]) => mockUserCreate(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
    role: { findUnique: (...a: unknown[]) => mockRoleFindUnique(...a) },
    userRoleAssignment: {
      findFirst: (...a: unknown[]) => mockUraFindFirst(...a),
      create: (...a: unknown[]) => mockUraCreate(...a),
    },
    magicLinkToken: {
      findUnique: (...a: unknown[]) => mockMagicFindUnique(...a),
      create: (...a: unknown[]) => mockMagicCreate(...a),
      update: (...a: unknown[]) => mockMagicUpdate(...a),
    },
    cart: { update: (...a: unknown[]) => mockCartUpdate(...a) },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  };
  return {
    mockDb,
    mockUserFindUnique,
    mockUserCreate,
    mockUserUpdate,
    mockQueryRaw,
    mockRoleFindUnique,
    mockUraFindFirst,
    mockUraCreate,
    mockMagicFindUnique,
    mockMagicCreate,
    mockMagicUpdate,
    mockCartUpdate,
  };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { mockFakeVerify, mockVerifyPassword, mockHashPassword } = vi.hoisted(() => ({
  mockFakeVerify: vi.fn().mockResolvedValue(undefined),
  mockVerifyPassword: vi.fn(),
  mockHashPassword: vi.fn().mockResolvedValue("$argon2id$new-hash"),
}));
vi.mock("../../lib/crypto.ts", () => ({
  fakeVerifyPassword: mockFakeVerify,
  verifyPassword: mockVerifyPassword,
  hashPassword: mockHashPassword,
}));

const { mockSignToken } = vi.hoisted(() => ({
  mockSignToken: vi.fn().mockResolvedValue("site.token"),
}));
vi.mock("../../lib/paseto.ts", () => ({ signToken: mockSignToken }));

const { mockIsLockedNow, mockRecordLoginFailure, mockRecordLoginSuccess } = vi.hoisted(() => ({
  mockIsLockedNow: vi.fn().mockReturnValue(false),
  mockRecordLoginFailure: vi.fn().mockResolvedValue({ attempts: 1, lockedUntil: null }),
  mockRecordLoginSuccess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/account-lockout.ts", () => ({
  isLockedNow: mockIsLockedNow,
  recordLoginFailure: mockRecordLoginFailure,
  recordLoginSuccess: mockRecordLoginSuccess,
}));

const { mockIsEmailThrottled, mockRecordEmailLoginFailure, mockClearEmailLoginFailure } =
  vi.hoisted(() => ({
    mockIsEmailThrottled: vi.fn().mockReturnValue({ blocked: false, retryAfterMs: 0 }),
    mockRecordEmailLoginFailure: vi.fn(),
    mockClearEmailLoginFailure: vi.fn(),
  }));
vi.mock("../../lib/login-throttle.ts", () => ({
  isEmailThrottled: mockIsEmailThrottled,
  recordEmailLoginFailure: mockRecordEmailLoginFailure,
  clearEmailLoginFailure: mockClearEmailLoginFailure,
}));

const { mockSendMagicLinkEmail } = vi.hoisted(() => ({
  mockSendMagicLinkEmail: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../../services/email/transactional.ts", () => ({
  sendMagicLinkEmail: mockSendMagicLinkEmail,
}));

vi.mock("../../services/cart.ts", () => ({
  CART_COOKIE_NAME: "cart_token",
  findCartByToken: vi.fn().mockResolvedValue(null),
}));

const { mockGetSiteSessionUser } = vi.hoisted(() => ({
  mockGetSiteSessionUser: vi.fn(),
}));
vi.mock("../../lib/auth.ts", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getSiteSessionUser: mockGetSiteSessionUser,
  };
});

import { siteAuthORPCRouter } from "../site-auth.ts";

function makeCtx(cookie?: string) {
  const setCookies: string[] = [];
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  const hono = {
    req: {
      raw: { headers },
      header: (n: string) => headers.get(n) ?? undefined,
    },
    header: (n: string, v: string) => {
      if (n.toLowerCase() === "set-cookie") setCookies.push(v);
    },
  };
  return { context: { hono: hono as never }, setCookies };
}

function siteUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    loginEmail: "shopper@bioalergia.cl",
    passwordHash: "$argon2id$stored",
    mfaEnabled: false,
    sessionVersion: 1,
    status: "ACTIVE",
    lockedUntil: null,
    person: { id: 5, email: "shopper@bioalergia.cl", names: "Grace Hopper", rut: null },
    passkeys: [],
    roles: [{ role: { name: "ShopCustomer" } }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsEmailThrottled.mockReturnValue({ blocked: false, retryAfterMs: 0 });
  mockIsLockedNow.mockReturnValue(false);
  mockSendMagicLinkEmail.mockResolvedValue({ ok: true });
  mockRoleFindUnique.mockResolvedValue({ id: 99 });
  mockUraFindFirst.mockResolvedValue({ id: 1 });
  mockSignToken.mockResolvedValue("site.token");
});

describe("site-auth.loginWithPassword", () => {
  it("success: sets site cookie + records success + clears throttle", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 11 }]); // findUserByEmail raw
    mockUserFindUnique.mockResolvedValueOnce(siteUserRow()); // findUserByEmail include
    mockVerifyPassword.mockResolvedValueOnce({ valid: true });

    const { context, setCookies } = makeCtx();
    const res = (await call(
      siteAuthORPCRouter.loginWithPassword,
      { email: "Shopper@Bioalergia.cl", password: "correct-horse" },
      { context }
    )) as { status: string; user: { id: number } };

    expect(res.status).toBe("ok");
    expect(res.user.id).toBe(11);
    expect(setCookies.some((c) => c.startsWith("bio_site_session="))).toBe(true);
    expect(mockRecordLoginSuccess).toHaveBeenCalledWith(11, null);
    expect(mockClearEmailLoginFailure).toHaveBeenCalled();
  });

  it("throttled: UNAUTHORIZED 'Demasiados intentos...' before lookup", async () => {
    mockIsEmailThrottled.mockReturnValueOnce({ blocked: true, retryAfterMs: 60_000 });

    const { context } = makeCtx();
    await expect(
      call(
        siteAuthORPCRouter.loginWithPassword,
        { email: "shopper@bioalergia.cl", password: "pw123456" },
        { context }
      )
    ).rejects.toMatchObject({ message: "Demasiados intentos. Vuelve a intentarlo más tarde." });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("unknown email / no password hash: constant-time fakeVerify + same error", async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // no user

    const { context } = makeCtx();
    await expect(
      call(
        siteAuthORPCRouter.loginWithPassword,
        { email: "nobody@bioalergia.cl", password: "pw123456" },
        { context }
      )
    ).rejects.toMatchObject({ message: "Credenciales incorrectas" });

    expect(mockFakeVerify).toHaveBeenCalledWith("pw123456");
    expect(mockRecordEmailLoginFailure).toHaveBeenCalled();
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("locked account: blocked with 'Cuenta bloqueada' before verify", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 11 }]);
    mockUserFindUnique.mockResolvedValueOnce(
      siteUserRow({ lockedUntil: new Date(Date.now() + 60_000) })
    );
    mockIsLockedNow.mockReturnValueOnce(true);

    const { context } = makeCtx();
    await expect(
      call(
        siteAuthORPCRouter.loginWithPassword,
        { email: "shopper@bioalergia.cl", password: "pw123456" },
        { context }
      )
    ).rejects.toMatchObject({ message: "Cuenta bloqueada temporalmente. Intenta más tarde." });
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("wrong password: recordLoginFailure + recordEmailLoginFailure + same error", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 11 }]);
    mockUserFindUnique.mockResolvedValueOnce(siteUserRow());
    mockVerifyPassword.mockResolvedValueOnce({ valid: false });

    const { context } = makeCtx();
    await expect(
      call(
        siteAuthORPCRouter.loginWithPassword,
        { email: "shopper@bioalergia.cl", password: "wrongpassword" },
        { context }
      )
    ).rejects.toMatchObject({ message: "Credenciales incorrectas" });

    expect(mockRecordLoginFailure).toHaveBeenCalledWith(11);
    expect(mockRecordEmailLoginFailure).toHaveBeenCalled();
  });
});

describe("site-auth.requestMagicLink", () => {
  it("creates token + sends email + NEVER logs the link/token", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    mockQueryRaw.mockResolvedValueOnce([{ id: 11 }]);
    mockUserFindUnique.mockResolvedValueOnce(siteUserRow());

    const { context } = makeCtx();
    const res = (await call(
      siteAuthORPCRouter.requestMagicLink,
      { email: "Shopper@Bioalergia.cl" },
      { context }
    )) as { status: string };

    expect(res.status).toBe("ok");
    expect(mockMagicCreate).toHaveBeenCalledTimes(1);
    expect(mockSendMagicLinkEmail).toHaveBeenCalledTimes(1);
    const emailArg = mockSendMagicLinkEmail.mock.calls[0]![0] as { url: string; to: string };
    expect(emailArg.to).toBe("shopper@bioalergia.cl");
    expect(emailArg.url).toContain("/mi-cuenta/auth/callback?token=");
    // The single-factor login token must never reach the logs.
    const loggedRaw = JSON.stringify(logSpy.mock.calls);
    expect(loggedRaw).not.toContain("/mi-cuenta/auth/callback?token=");
    logSpy.mockRestore();
  });

  it("creates a User shell when the email is unknown (still returns ok)", async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // unknown
    mockUserCreate.mockResolvedValueOnce(siteUserRow({ id: 22 }));

    const { context } = makeCtx();
    const res = (await call(
      siteAuthORPCRouter.requestMagicLink,
      { email: "newcomer@bioalergia.cl" },
      { context }
    )) as { status: string };

    expect(res.status).toBe("ok");
    expect(mockUserCreate).toHaveBeenCalledTimes(1);
    expect(mockMagicCreate).toHaveBeenCalledTimes(1);
    expect(mockSendMagicLinkEmail).toHaveBeenCalledTimes(1);
  });

  it("throttled: returns ok WITHOUT creating a token or sending mail (anti-enumeration)", async () => {
    mockIsEmailThrottled.mockReturnValueOnce({ blocked: true, retryAfterMs: 60_000 });

    const { context } = makeCtx();
    const res = (await call(
      siteAuthORPCRouter.requestMagicLink,
      { email: "shopper@bioalergia.cl" },
      { context }
    )) as { status: string };

    expect(res.status).toBe("ok");
    expect(mockMagicCreate).not.toHaveBeenCalled();
    expect(mockSendMagicLinkEmail).not.toHaveBeenCalled();
  });
});

describe("site-auth.consumeMagicLink", () => {
  it("valid token: consumes it + issues a session cookie", async () => {
    mockMagicFindUnique.mockResolvedValueOnce({
      id: 1,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: siteUserRow(),
    });

    const { context, setCookies } = makeCtx();
    const res = (await call(
      siteAuthORPCRouter.consumeMagicLink,
      { token: "rawtoken12345678" },
      { context }
    )) as { status: string };

    expect(res.status).toBe("ok");
    expect(mockMagicUpdate).toHaveBeenCalledTimes(1); // marked consumedAt
    expect(setCookies.some((c) => c.startsWith("bio_site_session="))).toBe(true);
  });

  it("expired token: UNAUTHORIZED 'Enlace inválido o expirado', no cookie", async () => {
    mockMagicFindUnique.mockResolvedValueOnce({
      id: 1,
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      user: siteUserRow(),
    });

    const { context, setCookies } = makeCtx();
    await expect(
      call(siteAuthORPCRouter.consumeMagicLink, { token: "rawtoken12345678" }, { context })
    ).rejects.toMatchObject({ message: "Enlace inválido o expirado" });
    expect(setCookies.length).toBe(0);
  });

  it("already-consumed token: rejected", async () => {
    mockMagicFindUnique.mockResolvedValueOnce({
      id: 1,
      consumedAt: new Date(Date.now() - 5_000),
      expiresAt: new Date(Date.now() + 60_000),
      user: siteUserRow(),
    });

    const { context } = makeCtx();
    await expect(
      call(siteAuthORPCRouter.consumeMagicLink, { token: "rawtoken12345678" }, { context })
    ).rejects.toMatchObject({ message: "Enlace inválido o expirado" });
  });

  it("unknown token: rejected", async () => {
    mockMagicFindUnique.mockResolvedValueOnce(null);

    const { context } = makeCtx();
    await expect(
      call(siteAuthORPCRouter.consumeMagicLink, { token: "rawtoken12345678" }, { context })
    ).rejects.toMatchObject({ message: "Enlace inválido o expirado" });
  });
});
