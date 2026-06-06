import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    person: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ db: mockDb }));

const { countBroadcastRecipients, sendPatientBroadcast, unsubscribeByToken } =
  await import("../email/broadcast-service.ts");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("broadcast recipients", () => {
  it("counts only opted-in, non-unsubscribed, emailed persons", async () => {
    mockDb.person.count.mockResolvedValue(42);
    await expect(countBroadcastRecipients()).resolves.toBe(42);
    expect(mockDb.person.count).toHaveBeenCalledWith({
      where: { email: { not: null }, emailMarketingOptIn: true, emailUnsubscribedAt: null },
    });
  });

  it("dry-run returns recipient count without sending", async () => {
    mockDb.person.findMany.mockResolvedValue([
      { id: 1, email: "a@x.com", emailUnsubscribeToken: "t1" },
      { id: 2, email: "b@x.com", emailUnsubscribeToken: null },
    ]);
    const out = await sendPatientBroadcast({ subject: "s", html: "<p>h</p>", dryRun: true });
    expect(out).toEqual({ dryRun: true, recipients: 2, sent: 0, failed: 0 });
    // dry-run must NOT mint tokens or send
    expect(mockDb.person.update).not.toHaveBeenCalled();
  });
});

describe("unsubscribe by token", () => {
  it("throws NOT_FOUND on unknown token", async () => {
    mockDb.person.findUnique.mockResolvedValue(null);
    await expect(unsubscribeByToken("nope")).rejects.toMatchObject({ kind: "NOT_FOUND" });
  });

  it("is idempotent when already unsubscribed", async () => {
    mockDb.person.findUnique.mockResolvedValue({ id: 7, emailUnsubscribedAt: new Date() });
    const out = await unsubscribeByToken("tok");
    expect(out).toEqual({ ok: true, alreadyUnsubscribed: true });
    expect(mockDb.person.update).not.toHaveBeenCalled();
  });

  it("unsubscribes a fresh contact", async () => {
    mockDb.person.findUnique.mockResolvedValue({ id: 9, emailUnsubscribedAt: null });
    mockDb.person.update.mockResolvedValue({});
    const out = await unsubscribeByToken("tok");
    expect(out).toEqual({ ok: true, alreadyUnsubscribed: false });
    expect(mockDb.person.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { emailUnsubscribedAt: expect.any(Date), emailMarketingOptIn: false },
    });
  });
});
