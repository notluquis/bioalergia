/**
 * Tests for `resolveSessionUserFromToken` — the PASETO session gate that every
 * authenticated request flows through.
 *
 * Golden 2026 (OWASP ASVS 5.0 §7 Session Management): sessions enforce an idle
 * timeout AND an absolute TTL, suspended accounts are rejected, and a bumped
 * sessionVersion invalidates outstanding tokens (server-side logout-all).
 *
 * Regression anchor: the idle gate only touches lastActivityAt AFTER a session
 * passes it, so a returning user whose lastActivityAt is older than the
 * threshold would be locked out forever (the token is valid but nulled before
 * the timestamp can refresh). Login handlers MUST stamp lastActivityAt = now so
 * the new session starts inside the window — these tests pin both halves: the
 * gate rejects genuinely-idle sessions, and a freshly-stamped one is admitted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindUnique, mockUpdate, mockVerifyToken, mockDb } = vi.hoisted(() => {
  const mockFindUnique = vi.fn();
  const mockUpdate = vi.fn(async () => undefined);
  const mockVerifyToken = vi.fn();
  const mockDb = {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  };
  return { mockFindUnique, mockUpdate, mockVerifyToken, mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../paseto.ts", () => ({ verifyToken: (...args: unknown[]) => mockVerifyToken(...args) }));

const { resolveSessionUserFromToken } = await import("../auth.ts");

const HOUR = 60 * 60 * 1000;

type DbUser = {
  id: number;
  status: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  sessionVersion: number;
  lastActivityAt: Date | null;
  person: { email: string } | null;
  roles: Array<{ role: { name: string } }>;
};

function makeUser(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: 1,
    status: "ACTIVE",
    sessionVersion: 1,
    lastActivityAt: new Date(),
    person: { email: "user@bioalergia.cl" },
    roles: [{ role: { name: "ADMIN" } }],
    ...overrides,
  };
}

function sessionToken(overrides: Record<string, unknown> = {}) {
  // Shape verifyToken returns for a normal session PASETO.
  return { sub: "1", typ: "session", sv: 1, email: "user@bioalergia.cl", ...overrides };
}

describe("resolveSessionUserFromToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admits a fresh session and maps roles", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken());
    mockFindUnique.mockResolvedValueOnce(makeUser({ lastActivityAt: new Date() }));

    const result = await resolveSessionUserFromToken("tok");

    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.roles).toEqual([{ role: { name: "ADMIN" } }]);
    expect(result?.status).toBe("ACTIVE");
  });

  it("admits a first-ever session where lastActivityAt is null", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken());
    mockFindUnique.mockResolvedValueOnce(makeUser({ lastActivityAt: null }));

    const result = await resolveSessionUserFromToken("tok");

    expect(result?.id).toBe(1);
  });

  it("REGRESSION: rejects a session idle past the 8h threshold (the lockout gate)", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken());
    mockFindUnique.mockResolvedValueOnce(
      makeUser({ lastActivityAt: new Date(Date.now() - 9 * HOUR) })
    );

    const result = await resolveSessionUserFromToken("tok");

    // Genuinely-idle session is correctly nulled. The fix is NOT to weaken this
    // gate — it is that login stamps lastActivityAt = now, so a returning user's
    // FIRST request after authenticating looks fresh (see next test).
    expect(result).toBeNull();
  });

  it("REGRESSION: admits the session once lastActivityAt is freshly stamped (login fix)", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken());
    // Simulates state immediately after a login handler reset lastActivityAt.
    mockFindUnique.mockResolvedValueOnce(
      makeUser({ lastActivityAt: new Date(Date.now() - 1000) })
    );

    const result = await resolveSessionUserFromToken("tok");

    expect(result?.id).toBe(1);
  });

  it("rejects a token whose sessionVersion no longer matches (logout-all)", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken({ sv: 1 }));
    mockFindUnique.mockResolvedValueOnce(makeUser({ sessionVersion: 2 }));

    expect(await resolveSessionUserFromToken("tok")).toBeNull();
  });

  it("rejects a suspended account", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken());
    mockFindUnique.mockResolvedValueOnce(makeUser({ status: "SUSPENDED" }));

    expect(await resolveSessionUserFromToken("tok")).toBeNull();
  });

  it("rejects a non-session token type", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken({ typ: "password-reset" }));

    expect(await resolveSessionUserFromToken("tok")).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rejects when the subject claim is not a string", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken({ sub: 1 as unknown as string }));

    expect(await resolveSessionUserFromToken("tok")).toBeNull();
  });

  it("rejects when the user no longer exists", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken());
    mockFindUnique.mockResolvedValueOnce(null);

    expect(await resolveSessionUserFromToken("tok")).toBeNull();
  });

  it("returns null (never throws) when token verification rejects", async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error("bad signature"));

    await expect(resolveSessionUserFromToken("tok")).resolves.toBeNull();
  });

  it("touches lastActivityAt when past the write-throttle window", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken());
    mockFindUnique.mockResolvedValueOnce(
      makeUser({ lastActivityAt: new Date(Date.now() - 10 * 60 * 1000) })
    );

    await resolveSessionUserFromToken("tok");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: { lastActivityAt: Date } };
    expect(arg.data.lastActivityAt).toBeInstanceOf(Date);
  });

  it("does NOT touch lastActivityAt within the throttle window", async () => {
    mockVerifyToken.mockResolvedValueOnce(sessionToken());
    mockFindUnique.mockResolvedValueOnce(makeUser({ lastActivityAt: new Date(Date.now() - 1000) }));

    await resolveSessionUserFromToken("tok");

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
