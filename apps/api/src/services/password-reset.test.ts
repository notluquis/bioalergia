import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    user: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
  return { mockDb };
});
vi.mock("@finanzas/db", () => ({ db: mockDb }));
// Keep the email/network stack out of this unit test.
vi.mock("./email/transactional.ts", () => ({
  sendAccountInviteEmail: vi.fn(),
  sendPasswordResetLinkEmail: vi.fn(),
}));

import { consumeInviteToken, resetPasswordWithToken } from "./password-reset.ts";

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.user.update.mockResolvedValue({});
  mockDb.user.updateMany.mockResolvedValue({ count: 1 });
});

describe("resetPasswordWithToken", () => {
  // Forgot-password NEVER changes status — invited users onboard via the wizard
  // (consumeInviteToken), not this path. Guards against a self-service reset
  // activating a PENDING_SETUP account or unsuspending a SUSPENDED one.
  it.each(["PENDING_SETUP", "ACTIVE", "SUSPENDED"])(
    "sets the password without ever touching status (%s)",
    async (status) => {
      mockDb.user.findFirst.mockResolvedValue({ id: 7, status, passwordResetExpiresAt: future });
      await resetPasswordWithToken("tok", "longenoughpw");
      const data = mockDb.user.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("status");
      expect(data.passwordResetTokenHash).toBeNull();
      expect(data.passwordResetPurpose).toBeNull();
    }
  );

  it("rejects an expired token", async () => {
    mockDb.user.findFirst.mockResolvedValue({ id: 7, passwordResetExpiresAt: past });
    await expect(resetPasswordWithToken("tok", "longenoughpw")).rejects.toThrow();
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});

describe("consumeInviteToken", () => {
  const validInvitee = {
    id: 7,
    status: "PENDING_SETUP",
    sessionVersion: 3,
    loginEmail: "  ana@bioalergia.cl ",
    passwordResetExpiresAt: future,
    person: { email: "person@bioalergia.cl" },
    roles: [{ role: { name: "Socio" } }, { role: { name: "VIEWER" } }],
  };

  it("consumes the token and returns session data for a valid invite", async () => {
    mockDb.user.findFirst.mockResolvedValue(validInvitee);
    const res = await consumeInviteToken("tok");

    expect(res).toEqual({
      userId: 7,
      loginEmail: "ana@bioalergia.cl",
      roles: ["Socio", "VIEWER"],
      sessionVersion: 3,
    });
    // Atomic single-use: the conditional updateMany still matches the token
    // hash + purpose, and status is left for the wizard.
    const call = mockDb.user.updateMany.mock.calls[0][0];
    expect(call.where.passwordResetPurpose).toBe("invite");
    expect(typeof call.where.passwordResetTokenHash).toBe("string");
    expect(call.data.passwordResetTokenHash).toBeNull();
    expect(call.data.passwordResetPurpose).toBeNull();
    expect(call.data).not.toHaveProperty("status");
  });

  it("falls back to the person email when loginEmail is empty", async () => {
    mockDb.user.findFirst.mockResolvedValue({ ...validInvitee, loginEmail: null });
    const res = await consumeInviteToken("tok");
    expect(res.loginEmail).toBe("person@bioalergia.cl");
  });

  it("rejects the loser of a race (updateMany affected 0 rows)", async () => {
    mockDb.user.findFirst.mockResolvedValue(validInvitee);
    mockDb.user.updateMany.mockResolvedValueOnce({ count: 0 }); // another request already consumed it
    await expect(consumeInviteToken("tok")).rejects.toThrow();
  });

  it("rejects an expired invite", async () => {
    mockDb.user.findFirst.mockResolvedValue({ ...validInvitee, passwordResetExpiresAt: past });
    await expect(consumeInviteToken("tok")).rejects.toThrow();
    expect(mockDb.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when the account is no longer PENDING_SETUP (already onboarded)", async () => {
    mockDb.user.findFirst.mockResolvedValue({ ...validInvitee, status: "ACTIVE" });
    await expect(consumeInviteToken("tok")).rejects.toThrow();
    expect(mockDb.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown token (only purpose=invite matches the query → null)", async () => {
    mockDb.user.findFirst.mockResolvedValue(null);
    await expect(consumeInviteToken("tok")).rejects.toThrow();
  });
});
