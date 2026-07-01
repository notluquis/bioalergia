import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Characterization tests pinning the CURRENT security behavior of the
// intranet auth handlers (apps/api/src/orpc/auth.ts). These were recently
// hardened (MFA-pending token, TOTP anti-replay, per-email throttle,
// per-user lockout, constant-time anti-enumeration) with NO test coverage.
// The handlers are oRPC procedures; we invoke them via `call(...)` with a
// minimal fake Hono context and full lib mocks. A regression here breaks
// login for a medical clinic, so these tests pin behavior precisely.

const {
  mockDb,
  mockUserFindUnique,
  mockUserUpdate,
  mockQueryRaw,
  mockAuditCreate,
  mockPasskeyCount,
} = vi.hoisted(() => {
  const mockUserFindUnique = vi.fn();
  const mockUserUpdate = vi.fn().mockResolvedValue({});
  const mockQueryRaw = vi.fn();
  const mockAuditCreate = vi.fn().mockResolvedValue({});
  const mockPasskeyCount = vi.fn().mockResolvedValue(0);
  // $qb chainable que delega en mockQueryRaw: executeTakeFirst desenvuelve el
  // array (findUserByLoginIdentifier ahora usa db.$qb.…executeTakeFirst()).
  const qb: Record<string, unknown> = {};
  for (const m of [
    "selectFrom",
    "innerJoin",
    "leftJoin",
    "select",
    "where",
    "limit",
    "offset",
    "orderBy",
    "groupBy",
  ]) {
    qb[m] = () => qb;
  }
  qb.executeTakeFirst = async (...a: unknown[]) => {
    const r = await mockQueryRaw(...a);
    return Array.isArray(r) ? r[0] : r;
  };
  qb.execute = (...a: unknown[]) => mockQueryRaw(...a);
  const mockDb = {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
    passkey: { count: (...a: unknown[]) => mockPasskeyCount(...a) },
    auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
    pushSubscription: { deleteMany: vi.fn().mockResolvedValue({}) },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    $qb: qb,
  };
  return { mockDb, mockUserFindUnique, mockUserUpdate, mockQueryRaw, mockAuditCreate, mockPasskeyCount };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

// auth.requireMfa setting — default OFF; individual tests flip it on.
const { mockGetSetting } = vi.hoisted(() => ({
  mockGetSetting: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../lib/settings.ts", () => ({ getSetting: mockGetSetting }));

// --- lib mocks ------------------------------------------------------------
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

const { mockSignToken, mockVerifyToken } = vi.hoisted(() => ({
  mockSignToken: vi.fn().mockResolvedValue("signed.token"),
  mockVerifyToken: vi.fn(),
}));
vi.mock("../../lib/paseto.ts", () => ({
  signToken: mockSignToken,
  verifyToken: mockVerifyToken,
}));

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

const { mockGetAbilityRulesForUser } = vi.hoisted(() => ({
  mockGetAbilityRulesForUser: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../lib/authz.ts", () => ({
  getAbilityRulesForUser: mockGetAbilityRulesForUser,
}));

const { mockVerifyMfaToken, mockIsTotpReplay, mockRecordTotpAccepted } = vi.hoisted(() => ({
  mockVerifyMfaToken: vi.fn().mockResolvedValue(true),
  mockIsTotpReplay: vi.fn().mockReturnValue(false),
  mockRecordTotpAccepted: vi.fn(),
}));
vi.mock("../../services/mfa.ts", () => ({
  verifyMfaToken: mockVerifyMfaToken,
  isTotpReplay: mockIsTotpReplay,
  recordTotpAccepted: mockRecordTotpAccepted,
}));

vi.mock("../../lib/secret-cipher.ts", () => ({
  decryptSecret: vi.fn().mockReturnValue("DECRYPTEDSECRET"),
  encryptSecret: vi.fn().mockReturnValue("ENCRYPTEDSECRET"),
}));

const { mockLogAuditFromContext } = vi.hoisted(() => ({
  mockLogAuditFromContext: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/audit-log.ts", () => ({
  logAuditFromContext: mockLogAuditFromContext,
  ipFromContext: vi.fn().mockReturnValue("1.2.3.4"),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// resolveSessionUserFromToken / getSessionUser / hasPermission aren't on the
// login/loginMfa hot paths but auth.ts imports them at module load.
vi.mock("../../lib/auth.ts", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    resolveSessionUserFromToken: vi.fn(),
    getSessionUser: vi.fn(),
    hasPermission: vi.fn(),
  };
});

import { authORPCRouter } from "../auth.ts";

// --- fake Hono context ----------------------------------------------------
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

// Minimal user row shaped like the findUnique include in the login handler.
function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    passwordHash: "$argon2id$stored",
    mfaEnabled: false,
    mfaSecret: null,
    sessionVersion: 1,
    status: "ACTIVE",
    lockedUntil: null,
    lastActivityAt: null,
    person: { email: "user@bioalergia.cl", names: "Ada Lovelace" },
    roles: [{ role: { name: "Admin", permissions: [] } }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsEmailThrottled.mockReturnValue({ blocked: false, retryAfterMs: 0 });
  mockIsLockedNow.mockReturnValue(false);
  mockVerifyMfaToken.mockResolvedValue(true);
  mockIsTotpReplay.mockReturnValue(false);
  mockSignToken.mockResolvedValue("signed.token");
  mockGetAbilityRulesForUser.mockResolvedValue([]);
  mockHashPassword.mockResolvedValue("$argon2id$new-hash");
  mockGetSetting.mockResolvedValue(null);
  mockPasskeyCount.mockResolvedValue(0);
});

describe("auth.login — continuous MFA enforcement (auth.requireMfa)", () => {
  function primePasswordOk(row: Record<string, unknown>) {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 7, loginEmail: "user@bioalergia.cl", notificationEmail: "user@bioalergia.cl" },
    ]);
    mockUserFindUnique.mockResolvedValueOnce(userRow(row));
    mockVerifyPassword.mockResolvedValueOnce({ valid: true, needsRehash: false });
  }
  const creds = { email: "user@bioalergia.cl", password: "correct-horse" };

  it("setting OFF: mfaEnforced account with no factor still gets a normal session (no mass lockout)", async () => {
    mockGetSetting.mockResolvedValue(null); // auth.requireMfa unset → OFF
    primePasswordOk({ mfaEnforced: true, mfaEnabled: false });
    const { context, setCookies } = makeCtx();
    const res = (await call(authORPCRouter.login, creds, { context })) as { status: string };
    expect(res.status).toBe("ok");
    expect(setCookies.some((c) => c.startsWith("finanzas_session="))).toBe(true);
  });

  it("setting ON + enforced + no TOTP + no passkey → mfa_setup_required and NO session cookie", async () => {
    mockGetSetting.mockResolvedValue("true");
    mockPasskeyCount.mockResolvedValue(0);
    primePasswordOk({ mfaEnforced: true, mfaEnabled: false });
    const { context, setCookies } = makeCtx();
    const res = (await call(authORPCRouter.login, creds, { context })) as {
      status: string;
      setupToken: string;
    };
    expect(res.status).toBe("mfa_setup_required");
    expect(res.setupToken).toBe("signed.token");
    expect(setCookies.some((c) => c.startsWith("finanzas_session="))).toBe(false);
  });

  it("setting ON + enforced + owns a passkey → 401 (must use the passkey, no session)", async () => {
    mockGetSetting.mockResolvedValue("true");
    mockPasskeyCount.mockResolvedValue(1);
    primePasswordOk({ mfaEnforced: true, mfaEnabled: false });
    const { context } = makeCtx();
    await expect(call(authORPCRouter.login, creds, { context })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("setting ON + PENDING_SETUP (onboarding) is NOT intercepted — keeps flowing", async () => {
    mockGetSetting.mockResolvedValue("true");
    primePasswordOk({ mfaEnforced: true, mfaEnabled: false, status: "PENDING_SETUP" });
    const { context, setCookies } = makeCtx();
    const res = (await call(authORPCRouter.login, creds, { context })) as { status: string };
    expect(res.status).toBe("ok");
    expect(setCookies.some((c) => c.startsWith("finanzas_session="))).toBe(true);
  });
});

describe("auth.login", () => {
  it("success: returns ok + user + abilityRules, sets cookie, stamps lastActivityAt", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 7, loginEmail: "user@bioalergia.cl", notificationEmail: "user@bioalergia.cl" },
    ]);
    mockUserFindUnique.mockResolvedValueOnce(userRow());
    mockVerifyPassword.mockResolvedValueOnce({ valid: true, needsRehash: false });
    mockGetAbilityRulesForUser.mockResolvedValueOnce([{ action: "read", subject: "all" }]);

    const { context, setCookies } = makeCtx();
    const res = (await call(
      authORPCRouter.login,
      { email: "User@Bioalergia.cl", password: "correct-horse" },
      { context }
    )) as { status: string; user: { id: number }; abilityRules: unknown[] };

    expect(res.status).toBe("ok");
    expect(res.user.id).toBe(7);
    expect(res.abilityRules).toEqual([{ action: "read", subject: "all" }]);
    // Cookie set with the session token.
    expect(setCookies.some((c) => c.startsWith("finanzas_session="))).toBe(true);
    // lastActivityAt stamped (the dedicated update with lastActivityAt).
    expect(
      mockUserUpdate.mock.calls.some(
        (c) =>
          (c[0] as { data?: { lastActivityAt?: unknown } }).data?.lastActivityAt instanceof Date
      )
    ).toBe(true);
    expect(mockRecordLoginSuccess).toHaveBeenCalledWith(7, "1.2.3.4");
    expect(mockClearEmailLoginFailure).toHaveBeenCalled();
  });

  it("wrong password: UNAUTHORIZED 'Credenciales incorrectas' + recordLoginFailure called", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 7, loginEmail: "user@bioalergia.cl", notificationEmail: "user@bioalergia.cl" },
    ]);
    mockUserFindUnique.mockResolvedValueOnce(userRow());
    mockVerifyPassword.mockResolvedValueOnce({ valid: false, needsRehash: false });

    const { context } = makeCtx();
    await expect(
      call(authORPCRouter.login, { email: "user@bioalergia.cl", password: "wrong" }, { context })
    ).rejects.toMatchObject({ message: "Credenciales incorrectas" });

    expect(mockRecordLoginFailure).toHaveBeenCalledWith(7);
    expect(mockRecordEmailLoginFailure).toHaveBeenCalled();
  });

  it("user-not-found: constant-time fakeVerifyPassword + same error (no enumeration)", async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // findUserByLoginIdentifier → null

    const { context } = makeCtx();
    await expect(
      call(
        authORPCRouter.login,
        { email: "nobody@bioalergia.cl", password: "pw123456" },
        { context }
      )
    ).rejects.toMatchObject({ message: "Credenciales incorrectas" });

    expect(mockFakeVerify).toHaveBeenCalledWith("pw123456");
    expect(mockRecordEmailLoginFailure).toHaveBeenCalled();
    // No per-user verify attempted — the user does not exist.
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("email-throttled: RATE_LIMITED before any DB lookup", async () => {
    mockIsEmailThrottled.mockReturnValueOnce({ blocked: true, retryAfterMs: 60_000 });

    const { context } = makeCtx();
    await expect(
      call(authORPCRouter.login, { email: "user@bioalergia.cl", password: "pw123456" }, { context })
    ).rejects.toMatchObject({ kind: "RATE_LIMITED", status: 429 });

    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockFakeVerify).not.toHaveBeenCalled();
  });

  it("locked account: blocked with 'Cuenta bloqueada' before password check", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 7, loginEmail: "user@bioalergia.cl", notificationEmail: "user@bioalergia.cl" },
    ]);
    mockUserFindUnique.mockResolvedValueOnce(
      userRow({ lockedUntil: new Date(Date.now() + 60_000) })
    );
    mockIsLockedNow.mockReturnValueOnce(true);

    const { context } = makeCtx();
    await expect(
      call(authORPCRouter.login, { email: "user@bioalergia.cl", password: "pw123456" }, { context })
    ).rejects.toMatchObject({ message: "Cuenta bloqueada temporalmente. Intenta más tarde." });

    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("mfaEnabled: returns status 'mfa_required' + userId + mfaToken, does NOT set full session cookie", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 7, loginEmail: "user@bioalergia.cl", notificationEmail: "user@bioalergia.cl" },
    ]);
    mockUserFindUnique.mockResolvedValueOnce(userRow({ mfaEnabled: true }));
    mockVerifyPassword.mockResolvedValueOnce({ valid: true, needsRehash: false });
    mockSignToken.mockResolvedValueOnce("mfa.pending.token");

    const { context, setCookies } = makeCtx();
    const res = (await call(
      authORPCRouter.login,
      { email: "user@bioalergia.cl", password: "correct-horse" },
      { context }
    )) as { status: string; userId: number; mfaToken: string };

    expect(res.status).toBe("mfa_required");
    expect(res.userId).toBe(7);
    expect(res.mfaToken).toBe("mfa.pending.token");
    // The mfa-pending token was minted (typ mfa-pending), NOT a session.
    expect(mockSignToken).toHaveBeenCalledWith(
      expect.objectContaining({ typ: "mfa-pending", sub: 7 }),
      "5m"
    );
    // No session cookie set at the password step.
    expect(setCookies.some((c) => c.startsWith("finanzas_session="))).toBe(false);
    // Success NOT recorded yet — completion happens after MFA.
    expect(mockRecordLoginSuccess).not.toHaveBeenCalled();
  });

  it("needsRehash: rehashes the password and persists the new hash", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 7, loginEmail: "user@bioalergia.cl", notificationEmail: "user@bioalergia.cl" },
    ]);
    mockUserFindUnique.mockResolvedValueOnce(userRow());
    mockVerifyPassword.mockResolvedValueOnce({ valid: true, needsRehash: true });

    const { context } = makeCtx();
    await call(
      authORPCRouter.login,
      { email: "user@bioalergia.cl", password: "correct-horse" },
      { context }
    );

    expect(mockHashPassword).toHaveBeenCalledWith("correct-horse");
    expect(
      mockUserUpdate.mock.calls.some(
        (c) =>
          (c[0] as { data?: { passwordHash?: unknown } }).data?.passwordHash ===
          "$argon2id$new-hash"
      )
    ).toBe(true);
  });
});

describe("auth.loginMfa", () => {
  it("rejects a bare/invalid mfaToken with 'Sesión MFA expirada...'", async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error("Invalid token"));

    const { context } = makeCtx();
    await expect(
      call(authORPCRouter.loginMfa, { token: "123456", mfaToken: "garbage" }, { context })
    ).rejects.toMatchObject({
      message: "Sesión MFA expirada. Ingresa tu contraseña nuevamente.",
    });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a token whose typ is not 'mfa-pending' (can't skip first factor)", async () => {
    // A full session token must NOT be accepted as a first-factor proof.
    mockVerifyToken.mockResolvedValueOnce({ typ: "session", sub: 7 });

    const { context } = makeCtx();
    await expect(
      call(authORPCRouter.loginMfa, { token: "123456", mfaToken: "session.tok" }, { context })
    ).rejects.toMatchObject({
      message: "Sesión MFA expirada. Ingresa tu contraseña nuevamente.",
    });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("valid pending token + valid TOTP: issues session + sets cookie + records success", async () => {
    mockVerifyToken.mockResolvedValueOnce({ typ: "mfa-pending", sub: 7 });
    mockUserFindUnique.mockResolvedValueOnce(
      userRow({ mfaEnabled: true, mfaSecret: "ENCRYPTEDSECRET" })
    );
    mockQueryRaw.mockResolvedValueOnce([
      { loginEmail: "user@bioalergia.cl", notificationEmail: "user@bioalergia.cl" },
    ]);
    mockVerifyMfaToken.mockResolvedValueOnce(true);

    const { context, setCookies } = makeCtx();
    const res = (await call(
      authORPCRouter.loginMfa,
      { token: "123456", mfaToken: "pending.tok" },
      { context }
    )) as { status: string };

    expect(res.status).toBe("ok");
    expect(setCookies.some((c) => c.startsWith("finanzas_session="))).toBe(true);
    expect(mockRecordTotpAccepted).toHaveBeenCalledWith(7, "123456");
    expect(mockRecordLoginSuccess).toHaveBeenCalledWith(7, "1.2.3.4");
  });

  it("invalid TOTP: recordLoginFailure + UNAUTHORIZED 'Código incorrecto'", async () => {
    mockVerifyToken.mockResolvedValueOnce({ typ: "mfa-pending", sub: 7 });
    mockUserFindUnique.mockResolvedValueOnce(
      userRow({ mfaEnabled: true, mfaSecret: "ENCRYPTEDSECRET" })
    );
    mockVerifyMfaToken.mockResolvedValueOnce(false);

    const { context } = makeCtx();
    await expect(
      call(authORPCRouter.loginMfa, { token: "000000", mfaToken: "pending.tok" }, { context })
    ).rejects.toMatchObject({ message: "Código incorrecto" });

    expect(mockRecordLoginFailure).toHaveBeenCalledWith(7);
    expect(mockRecordTotpAccepted).not.toHaveBeenCalled();
  });

  it("TOTP replay: a replayed code is rejected even if otherwise valid", async () => {
    mockVerifyToken.mockResolvedValueOnce({ typ: "mfa-pending", sub: 7 });
    mockUserFindUnique.mockResolvedValueOnce(
      userRow({ mfaEnabled: true, mfaSecret: "ENCRYPTEDSECRET" })
    );
    // Replay guard trips → isValid short-circuits to false (verifyMfaToken
    // may still return true but the && with !isTotpReplay makes it false).
    mockIsTotpReplay.mockReturnValueOnce(true);
    mockVerifyMfaToken.mockResolvedValueOnce(true);

    const { context } = makeCtx();
    await expect(
      call(authORPCRouter.loginMfa, { token: "123456", mfaToken: "pending.tok" }, { context })
    ).rejects.toMatchObject({ message: "Código incorrecto" });

    expect(mockRecordLoginFailure).toHaveBeenCalledWith(7);
  });
});

describe("auth.passkeyLoginOptions", () => {
  it("passes userVerification 'required' to the authenticator", async () => {
    const { context } = makeCtx();
    const res = (await call(authORPCRouter.passkeyLoginOptions, undefined, { context })) as {
      userVerification?: string;
    };
    expect(res.userVerification).toBe("required");
  });
});

describe("auth.passkeyRegisterOptions", () => {
  it("requests userVerification 'required' for registration", async () => {
    const { resolveSessionUserFromToken } = await import("../../lib/auth.ts");
    vi.mocked(resolveSessionUserFromToken).mockResolvedValueOnce({
      id: 7,
      email: "user@bioalergia.cl",
      roles: ["Admin"],
      sessionVersion: 1,
    } as never);
    mockUserFindUnique.mockResolvedValueOnce({
      id: 7,
      person: { email: "user@bioalergia.cl", names: "Ada" },
    });

    const { context } = makeCtx("finanzas_session=sometoken");
    const res = (await call(authORPCRouter.passkeyRegisterOptions, undefined, { context })) as {
      authenticatorSelection?: { userVerification?: string };
    };
    expect(res.authenticatorSelection?.userVerification).toBe("required");
  });
});
