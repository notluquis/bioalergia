import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Handler-level tests for the onboarding-critical users procedures: `invite`
// (admin creates a PENDING_SETUP user + emails a set-password link) and `setup`
// (the user completes onboarding → ACTIVE). Invoked via `call(...)` with a fake
// Hono context and mocked db + services, mirroring auth-flows.test.ts.

const { mockDb, m } = vi.hoisted(() => {
  const m = {
    userFindFirst: vi.fn(),
    userFindUnique: vi.fn(),
    userCreate: vi.fn(),
    userUpdate: vi.fn().mockResolvedValue({}),
    roleFindUnique: vi.fn(),
    roleAssignCreate: vi.fn().mockResolvedValue({}),
    employeeUpsert: vi.fn().mockResolvedValue({}),
    personFindUnique: vi.fn(),
    personUpdate: vi.fn().mockResolvedValue({}),
    passkeyCount: vi.fn().mockResolvedValue(0),
  };
  const mockDb = {
    user: {
      findFirst: (...a: unknown[]) => m.userFindFirst(...a),
      findUnique: (...a: unknown[]) => m.userFindUnique(...a),
      create: (...a: unknown[]) => m.userCreate(...a),
      update: (...a: unknown[]) => m.userUpdate(...a),
    },
    role: { findUnique: (...a: unknown[]) => m.roleFindUnique(...a) },
    userRoleAssignment: { create: (...a: unknown[]) => m.roleAssignCreate(...a) },
    employee: { upsert: (...a: unknown[]) => m.employeeUpsert(...a) },
    person: {
      findUnique: (...a: unknown[]) => m.personFindUnique(...a),
      update: (...a: unknown[]) => m.personUpdate(...a),
    },
    passkey: { count: (...a: unknown[]) => m.passkeyCount(...a) },
  };
  return { mockDb, m };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { mockGetSessionUser, mockHasPermission } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockHasPermission: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../lib/auth.ts", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getSessionUser: mockGetSessionUser, hasPermission: mockHasPermission };
});

const { mockSendAccountInvite } = vi.hoisted(() => ({
  mockSendAccountInvite: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../services/password-reset.ts", () => ({ sendAccountInvite: mockSendAccountInvite }));

const { mockFindUserByEffectiveLoginEmail } = vi.hoisted(() => ({
  mockFindUserByEffectiveLoginEmail: vi.fn().mockResolvedValue(null),
}));
// Keep the pure helpers real; only the DB-touching lookup is a stub.
vi.mock("../../services/users.ts", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, findUserByEffectiveLoginEmail: mockFindUserByEffectiveLoginEmail };
});

vi.mock("../../lib/crypto.ts", () => ({ hashPassword: vi.fn().mockResolvedValue("$argon2id$h") }));
vi.mock("../../services/email/transactional.ts", () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("../../lib/logger.ts", () => ({ logError: vi.fn(), logEvent: vi.fn() }));

import { usersORPCRouter } from "../users.ts";

function ctx() {
  const hono = { req: { raw: { headers: new Headers() }, header: () => undefined } };
  return { context: { hono: hono as never } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 1, status: "ACTIVE" });
  mockHasPermission.mockResolvedValue(true);
  mockSendAccountInvite.mockResolvedValue(true);
  mockFindUserByEffectiveLoginEmail.mockResolvedValue(null);
  m.passkeyCount.mockResolvedValue(0);
});

describe("users.invite", () => {
  const input = {
    email: "Nuevo@Bioalergia.CL",
    role: "VIEWER",
    position: "Enfermera",
    personId: 50,
    mfaEnforced: true,
  };

  function primeHappyPath() {
    m.userFindFirst.mockResolvedValueOnce(null); // no existing user by person email
    // resolveInvitePersonId(personId=50): person exists with matching email → returns 50.
    m.personFindUnique
      .mockResolvedValueOnce({ id: 50, email: "nuevo@bioalergia.cl" })
      .mockResolvedValueOnce({ names: "Carla Díaz" }); // greeting lookup
    m.userCreate.mockResolvedValueOnce({ id: 99 });
    m.roleFindUnique.mockResolvedValueOnce({ id: 3 });
  }

  it("creates a PENDING_SETUP user, assigns role, and emails the invite link", async () => {
    primeHappyPath();
    const res = (await call(usersORPCRouter.invite, input, ctx())) as {
      status: string;
      userId: number;
      emailed: boolean;
    };

    expect(res).toEqual({ status: "ok", userId: 99, emailed: true });
    expect(m.userCreate.mock.calls[0][0].data.status).toBe("PENDING_SETUP");
    expect(m.roleAssignCreate).toHaveBeenCalledWith({ data: { userId: 99, roleId: 3 } });
    // Emails the normalized (lowercased) address + the person's name.
    expect(mockSendAccountInvite).toHaveBeenCalledWith({
      userId: 99,
      to: "nuevo@bioalergia.cl",
      name: "Carla Díaz",
    });
  });

  it("returns emailed=false when the invite email could not be sent", async () => {
    primeHappyPath();
    mockSendAccountInvite.mockResolvedValueOnce(false);
    const res = (await call(usersORPCRouter.invite, input, ctx())) as { emailed: boolean };
    expect(res.emailed).toBe(false);
  });

  it("rejects a duplicate email before creating anything", async () => {
    m.userFindFirst.mockResolvedValueOnce({ id: 7 }); // email already registered
    await expect(call(usersORPCRouter.invite, input, ctx())).rejects.toThrow(/ya registrado/i);
    expect(m.userCreate).not.toHaveBeenCalled();
    expect(mockSendAccountInvite).not.toHaveBeenCalled();
  });

  it("forbids callers without create:User permission", async () => {
    mockHasPermission.mockResolvedValueOnce(false);
    await expect(call(usersORPCRouter.invite, input, ctx())).rejects.toThrow();
    expect(m.userCreate).not.toHaveBeenCalled();
  });
});

describe("users.setup", () => {
  const input = {
    names: "Diego Soto",
    rut: "12.345.678-5", // valid CL verifier
    password: "Strong!Passw0rd",
    phone: "+56911112222",
  };

  it("completes setup and flips PENDING_SETUP → ACTIVE", async () => {
    mockGetSessionUser.mockResolvedValue({ id: 7, status: "PENDING_SETUP" });
    m.userFindUnique.mockResolvedValueOnce({
      id: 7,
      status: "PENDING_SETUP",
      personId: 50,
      person: { email: "diego@bioalergia.cl" },
    });

    const res = (await call(usersORPCRouter.setup, input, ctx())) as { status: string };
    expect(res.status).toBe("ok");
    // One of the user.update calls sets status ACTIVE.
    const setActive = m.userUpdate.mock.calls.some((c) => c[0]?.data?.status === "ACTIVE");
    expect(setActive).toBe(true);
    expect(m.personUpdate).toHaveBeenCalled();
  });

  it("is a no-op for an already-ACTIVE account (idempotent)", async () => {
    mockGetSessionUser.mockResolvedValue({ id: 7, status: "ACTIVE" });
    m.userFindUnique.mockResolvedValueOnce({
      id: 7,
      status: "ACTIVE",
      personId: 50,
      person: { email: "diego@bioalergia.cl" },
    });

    const res = (await call(usersORPCRouter.setup, input, ctx())) as { message?: string };
    expect(res.message).toMatch(/ya configurada/i);
    expect(m.userUpdate).not.toHaveBeenCalled();
  });

  // Server-side MFA enforcement: an mfaEnforced account cannot activate without a
  // second factor (TOTP enabled OR a registered passkey). Closes the direct-POST
  // bypass of the client-side "skip" hiding.
  function primePendingSetup(overrides: Record<string, unknown>) {
    mockGetSessionUser.mockResolvedValue({ id: 7, status: "PENDING_SETUP" });
    m.userFindUnique.mockResolvedValueOnce({
      id: 7,
      status: "PENDING_SETUP",
      personId: 50,
      person: { email: "diego@bioalergia.cl" },
      ...overrides,
    });
  }

  it("rejects activation when mfaEnforced and there is no factor (no TOTP, no passkey)", async () => {
    primePendingSetup({ mfaEnforced: true, mfaEnabled: false });
    m.passkeyCount.mockResolvedValueOnce(0);
    await expect(call(usersORPCRouter.setup, input, ctx())).rejects.toThrow(/MFA|passkey/i);
    const setActive = m.userUpdate.mock.calls.some((c) => c[0]?.data?.status === "ACTIVE");
    expect(setActive).toBe(false);
  });

  it("activates when mfaEnforced and the user has a registered passkey", async () => {
    primePendingSetup({ mfaEnforced: true, mfaEnabled: false });
    m.passkeyCount.mockResolvedValueOnce(1);
    const res = (await call(usersORPCRouter.setup, input, ctx())) as { status: string };
    expect(res.status).toBe("ok");
    expect(m.userUpdate.mock.calls.some((c) => c[0]?.data?.status === "ACTIVE")).toBe(true);
  });

  it("activates when mfaEnforced and TOTP is already enabled", async () => {
    primePendingSetup({ mfaEnforced: true, mfaEnabled: true });
    const res = (await call(usersORPCRouter.setup, input, ctx())) as { status: string };
    expect(res.status).toBe("ok");
    expect(m.userUpdate.mock.calls.some((c) => c[0]?.data?.status === "ACTIVE")).toBe(true);
  });
});

describe("users.resendInvite", () => {
  it("re-emails the invite link for a PENDING_SETUP user", async () => {
    m.userFindUnique.mockResolvedValueOnce({
      id: 8,
      status: "PENDING_SETUP",
      person: { email: "nuevo@bioalergia.cl", names: "Carla" },
    });
    const res = (await call(usersORPCRouter.resendInvite, { id: 8 }, ctx())) as {
      status: string;
      emailed: boolean;
    };
    expect(res).toEqual({ status: "ok", emailed: true });
    expect(mockSendAccountInvite).toHaveBeenCalledWith({
      userId: 8,
      to: "nuevo@bioalergia.cl",
      name: "Carla",
    });
  });

  it("surfaces emailed=false when the resend email fails", async () => {
    m.userFindUnique.mockResolvedValueOnce({
      id: 8,
      status: "PENDING_SETUP",
      person: { email: "nuevo@bioalergia.cl", names: "Carla" },
    });
    mockSendAccountInvite.mockResolvedValueOnce(false);
    const res = (await call(usersORPCRouter.resendInvite, { id: 8 }, ctx())) as { emailed: boolean };
    expect(res.emailed).toBe(false);
  });

  it("rejects a non-PENDING_SETUP (already ACTIVE) user", async () => {
    m.userFindUnique.mockResolvedValueOnce({
      id: 8,
      status: "ACTIVE",
      person: { email: "nuevo@bioalergia.cl", names: "Carla" },
    });
    await expect(call(usersORPCRouter.resendInvite, { id: 8 }, ctx())).rejects.toThrow(
      /pendientes de configuración/i
    );
    expect(mockSendAccountInvite).not.toHaveBeenCalled();
  });

  it("rejects a user without an email", async () => {
    m.userFindUnique.mockResolvedValueOnce({
      id: 8,
      status: "PENDING_SETUP",
      person: { email: null, names: "Carla" },
    });
    await expect(call(usersORPCRouter.resendInvite, { id: 8 }, ctx())).rejects.toThrow(/correo/i);
    expect(mockSendAccountInvite).not.toHaveBeenCalled();
  });
});
