import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    user: { findFirst: vi.fn(), update: vi.fn() },
  };
  return { mockDb };
});
vi.mock("@finanzas/db", () => ({ db: mockDb }));
// Keep the email/network stack out of this unit test.
vi.mock("./email/transactional.ts", () => ({
  sendAccountInviteEmail: vi.fn(),
  sendPasswordResetLinkEmail: vi.fn(),
}));

import { resetPasswordWithToken } from "./password-reset.ts";

const future = new Date(Date.now() + 60_000);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.user.update.mockResolvedValue({});
});

describe("resetPasswordWithToken", () => {
  it("activates a PENDING_SETUP user completing an invite link", async () => {
    mockDb.user.findFirst.mockResolvedValue({
      id: 7,
      status: "PENDING_SETUP",
      passwordResetPurpose: "invite",
      passwordResetExpiresAt: future,
    });
    await resetPasswordWithToken("tok", "longenoughpw");
    const data = mockDb.user.update.mock.calls[0][0].data;
    expect(data.status).toBe("ACTIVE");
    expect(data.passwordResetPurpose).toBeNull();
  });

  // The bug Codex caught: a PENDING_SETUP account using forgot-password (purpose
  // null/"reset") must NOT be activated — it stays in onboarding.
  it.each([null, "reset"])(
    "does NOT activate a PENDING_SETUP user when purpose is %s (forgot-password)",
    async (purpose) => {
      mockDb.user.findFirst.mockResolvedValue({
        id: 7,
        status: "PENDING_SETUP",
        passwordResetPurpose: purpose,
        passwordResetExpiresAt: future,
      });
      await resetPasswordWithToken("tok", "longenoughpw");
      expect(mockDb.user.update.mock.calls[0][0].data).not.toHaveProperty("status");
    }
  );

  it.each(["ACTIVE", "SUSPENDED"])(
    "never changes status of a %s user even with an invite-purpose token",
    async (status) => {
      mockDb.user.findFirst.mockResolvedValue({
        id: 7,
        status,
        passwordResetPurpose: "invite",
        passwordResetExpiresAt: future,
      });
      await resetPasswordWithToken("tok", "longenoughpw");
      expect(mockDb.user.update.mock.calls[0][0].data).not.toHaveProperty("status");
    }
  );

  it("rejects an expired token", async () => {
    mockDb.user.findFirst.mockResolvedValue({
      id: 7,
      status: "PENDING_SETUP",
      passwordResetPurpose: "invite",
      passwordResetExpiresAt: new Date(Date.now() - 60_000),
    });
    await expect(resetPasswordWithToken("tok", "longenoughpw")).rejects.toThrow();
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});
