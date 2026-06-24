import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, sendBatchMock } = vi.hoisted(() => ({
  mockDb: { outreachEmailCampaign: { findUnique: vi.fn() } },
  sendBatchMock: vi.fn(),
}));

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../../../services/outreach-email.ts", () => ({ sendOutreachNextBatch: sendBatchMock }));
vi.mock("../../../lib/logger.ts", () => ({ logEvent: vi.fn() }));

const { send_outreach_tick, outreachDrainJobKey } = await import("../outreach-send.ts");

function fakeHelpers() {
  return {
    addJob: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("send_outreach_tick", () => {
  it("stops the chain (no send, no re-enqueue) when campaign is not ENVIANDO", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue({ id: 1, estado: "PAUSADA" });
    const helpers = fakeHelpers();

    await send_outreach_tick({ campaignId: 1 }, helpers as never);

    expect(sendBatchMock).not.toHaveBeenCalled();
    expect(helpers.addJob).not.toHaveBeenCalled();
  });

  it("stops the chain when campaign is missing", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue(null);
    const helpers = fakeHelpers();

    await send_outreach_tick({ campaignId: 9 }, helpers as never);

    expect(sendBatchMock).not.toHaveBeenCalled();
    expect(helpers.addJob).not.toHaveBeenCalled();
  });

  it("sends one batch and does NOT re-enqueue when nothing remains", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue({
      id: 1,
      estado: "ENVIANDO",
      ratePerHour: 50,
    });
    sendBatchMock.mockResolvedValue({ sent: 4, failed: 0, remaining: 0 });
    const helpers = fakeHelpers();

    await send_outreach_tick({ campaignId: 1 }, helpers as never);

    expect(sendBatchMock).toHaveBeenCalledWith(1, expect.any(Number));
    expect(helpers.addJob).not.toHaveBeenCalled();
  });

  it("re-enqueues paced to ratePerHour while deliveries remain", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue({
      id: 7,
      estado: "ENVIANDO",
      ratePerHour: 50,
    });
    sendBatchMock.mockResolvedValue({ sent: 10, failed: 0, remaining: 30 });
    const helpers = fakeHelpers();

    await send_outreach_tick({ campaignId: 7 }, helpers as never);

    expect(helpers.addJob).toHaveBeenCalledTimes(1);
    const [identifier, payload, spec] = helpers.addJob.mock.calls[0]!;
    expect(identifier).toBe("send_outreach_tick");
    expect(payload).toEqual({ campaignId: 7 });
    expect(spec.jobKey).toBe(outreachDrainJobKey(7));
    expect(spec.jobKeyMode).toBe("replace");
    expect(spec.runAt).toBeInstanceOf(Date);
    // batch 10 / rate 50 → gap 3600*10/50 = 720s in the future
    expect(spec.runAt.getTime()).toBeGreaterThan(Date.now() + 700_000);
  });
});
