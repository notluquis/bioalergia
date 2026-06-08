import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";

const { mockDb, buildMock } = vi.hoisted(() => ({
  mockDb: {
    outreachEmailCampaign: { findUnique: vi.fn(), update: vi.fn() },
  },
  buildMock: vi.fn(),
}));

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../../modules/outreach/campaign-builder.ts", () => ({
  buildCampaignDeliveries: buildMock,
}));

const { launchOrResumeCampaign } = await import("../outreach-campaign.ts");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.outreachEmailCampaign.update.mockImplementation(async ({ data }: { data: unknown }) => ({
    id: 1,
    ...(data as object),
  }));
});

describe("launchOrResumeCampaign", () => {
  it("throws NOT_FOUND when the campaign is missing", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue(null);
    const err = await launchOrResumeCampaign(1).catch((e: unknown) => e);
    expect(isDomainError(err)).toBe(true);
    expect(err).toMatchObject({ kind: "NOT_FOUND" });
  });

  it("throws CONFLICT when the campaign is already completed", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue({ id: 1, estado: "COMPLETADA" });
    const err = await launchOrResumeCampaign(1).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: "CONFLICT" });
    expect(buildMock).not.toHaveBeenCalled();
  });

  it("fresh launch (BORRADOR) builds deliveries and stamps enviadoEn + ENVIANDO", async () => {
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue({
      id: 1,
      estado: "BORRADOR",
      enviadoEn: null,
    });

    await launchOrResumeCampaign(1);

    expect(buildMock).toHaveBeenCalledWith(1);
    const data = mockDb.outreachEmailCampaign.update.mock.calls[0]![0].data;
    expect(data.estado).toBe("ENVIANDO");
    expect(data.enviadoEn).toBeInstanceOf(Date);
  });

  it("resume (PAUSADA) does NOT rebuild deliveries and preserves the original enviadoEn", async () => {
    const first = new Date("2026-06-01T12:00:00Z");
    mockDb.outreachEmailCampaign.findUnique.mockResolvedValue({
      id: 1,
      estado: "PAUSADA",
      enviadoEn: first,
    });

    await launchOrResumeCampaign(1);

    expect(buildMock).not.toHaveBeenCalled();
    const data = mockDb.outreachEmailCampaign.update.mock.calls[0]![0].data;
    expect(data.estado).toBe("ENVIANDO");
    expect(data.enviadoEn).toBe(first);
  });
});
