import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = { person: { updateMany: vi.fn() } };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ db: mockDb }));

const { handleResendEvent, verifyResendSignature } = await import("../email/webhook-service.ts");

const SECRET_B64 = Buffer.from("super-secret-key-bytes").toString("base64");
const SECRET = `whsec_${SECRET_B64}`;

function sign(id: string, ts: string, body: string): string {
  const key = Buffer.from(SECRET_B64, "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return `v1,${sig}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.RESEND_WEBHOOK_SECRET;
});

describe("verifyResendSignature", () => {
  const body = '{"type":"email.bounced"}';
  const ts = String(Math.floor(Date.now() / 1000));
  const id = "msg_123";

  it("accepts a valid signature within tolerance", () => {
    const ok = verifyResendSignature(body, {
      svixId: id,
      svixTimestamp: ts,
      svixSignature: sign(id, ts, body),
    });
    expect(ok).toBe(true);
  });

  it("rejects a tampered body", () => {
    const ok = verifyResendSignature('{"type":"email.complained"}', {
      svixId: id,
      svixTimestamp: ts,
      svixSignature: sign(id, ts, body),
    });
    expect(ok).toBe(false);
  });

  it("rejects a stale timestamp (replay)", () => {
    const oldTs = String(Math.floor(Date.now() / 1000) - 10_000);
    const ok = verifyResendSignature(body, {
      svixId: id,
      svixTimestamp: oldTs,
      svixSignature: sign(id, oldTs, body),
    });
    expect(ok).toBe(false);
  });

  it("rejects when secret is missing", () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const ok = verifyResendSignature(body, {
      svixId: id,
      svixTimestamp: ts,
      svixSignature: sign(id, ts, body),
    });
    expect(ok).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(
      verifyResendSignature(body, { svixId: null, svixTimestamp: ts, svixSignature: "v1,x" })
    ).toBe(false);
  });
});

describe("handleResendEvent", () => {
  it("suppresses on permanent bounce", async () => {
    mockDb.person.updateMany.mockResolvedValue({ count: 1 });
    await handleResendEvent({
      type: "email.bounced",
      data: { to: ["hard@x.com"], bounce: { type: "Permanent" } },
    });
    expect(mockDb.person.updateMany).toHaveBeenCalledWith({
      where: { email: { in: ["hard@x.com"] }, emailUnsubscribedAt: null },
      data: { emailUnsubscribedAt: expect.any(Date), emailMarketingOptIn: false },
    });
  });

  it("ignores transient bounce", async () => {
    await handleResendEvent({
      type: "email.bounced",
      data: { to: ["soft@x.com"], bounce: { type: "Transient" } },
    });
    expect(mockDb.person.updateMany).not.toHaveBeenCalled();
  });

  it("suppresses on complaint", async () => {
    mockDb.person.updateMany.mockResolvedValue({ count: 1 });
    await handleResendEvent({ type: "email.complained", data: { to: ["spam@x.com"] } });
    expect(mockDb.person.updateMany).toHaveBeenCalledOnce();
  });

  it("no-ops on delivered/opened", async () => {
    await handleResendEvent({ type: "email.delivered", data: { to: ["a@x.com"] } });
    await handleResendEvent({ type: "email.opened", data: { to: ["a@x.com"] } });
    expect(mockDb.person.updateMany).not.toHaveBeenCalled();
  });
});
