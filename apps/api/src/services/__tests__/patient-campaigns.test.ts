import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";

// Characterization tests for the patient-campaigns service (golden 2026
// migration): DomainError kinds + the status-count aggregation + RUT
// normalization the recipient upsert relies on.

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    patientCampaign: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    patientCampaignRecipient: {
      groupBy: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    person: { findUnique: vi.fn() },
  },
}));

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { getPatientCampaign, listPatientCampaigns, upsertCampaignRecipient, updateRecipientStatus } =
  await import("../patient-campaigns.ts");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPatientCampaign", () => {
  it("throws NOT_FOUND when the campaign is missing", async () => {
    mockDb.patientCampaign.findUnique.mockResolvedValue(null);
    const err = await getPatientCampaign({ id: 1 }).catch((e: unknown) => e);
    expect(isDomainError(err)).toBe(true);
    expect(err).toMatchObject({ kind: "NOT_FOUND" });
  });

  it("aggregates status counts and totalRecipients", async () => {
    mockDb.patientCampaign.findUnique.mockResolvedValue({ id: 1, name: "Campaign" });
    mockDb.patientCampaignRecipient.groupBy.mockResolvedValue([
      { status: "PENDING", _count: { _all: 3 } },
      { status: "ACCEPTED", _count: { _all: 2 } },
    ]);

    const res = await getPatientCampaign({ id: 1 });

    expect(res.campaign.totalRecipients).toBe(5);
    expect(res.campaign.statusCounts.PENDING).toBe(3);
    expect(res.campaign.statusCounts.ACCEPTED).toBe(2);
    expect(res.campaign.statusCounts.SENT).toBe(0);
  });
});

describe("listPatientCampaigns", () => {
  it("short-circuits to empty when there are no campaigns (no groupBy call)", async () => {
    mockDb.patientCampaign.findMany.mockResolvedValue([]);
    const res = await listPatientCampaigns({});
    expect(res.campaigns).toEqual([]);
    expect(mockDb.patientCampaignRecipient.groupBy).not.toHaveBeenCalled();
  });
});

describe("upsertCampaignRecipient", () => {
  it("throws NOT_FOUND when the campaign does not exist", async () => {
    mockDb.patientCampaign.findUnique.mockResolvedValue(null);
    const err = await upsertCampaignRecipient(
      { campaignId: 9, patientRut: "12.345.678-5" },
      7
    ).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: "NOT_FOUND" });
  });

  it("normalizes the RUT and backfills name/phone from the person record", async () => {
    mockDb.patientCampaign.findUnique.mockResolvedValue({ id: 1 });
    mockDb.person.findUnique.mockResolvedValue({
      names: "Juan",
      fatherName: "Pérez",
      motherName: null,
      phone: "+56911112222",
    });
    mockDb.patientCampaignRecipient.upsert.mockImplementation(
      async ({ create }: { create: unknown }) => ({ id: 1, ...(create as object) })
    );

    const res = await upsertCampaignRecipient({ campaignId: 1, patientRut: "12.345.678-5" }, 7);

    // person lookup used the normalized RUT
    expect(mockDb.person.findUnique).toHaveBeenCalledWith({ where: { rut: "12345678-5" } });
    expect(res.recipient.patientRut).toBe("12345678-5");
    expect(res.recipient.patientName).toBe("Juan Pérez");
    expect(res.recipient.patientPhone).toBe("+56911112222");
  });
});

describe("updateRecipientStatus", () => {
  it("throws NOT_FOUND when the recipient is missing", async () => {
    mockDb.patientCampaignRecipient.findUnique.mockResolvedValue(null);
    const err = await updateRecipientStatus({ id: 1, status: "SENT" }, 7).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: "NOT_FOUND" });
  });

  it("stamps respondedAt on a terminal status when not previously set", async () => {
    mockDb.patientCampaignRecipient.findUnique.mockResolvedValue({
      id: 1,
      sentAt: new Date(),
      respondedAt: null,
    });
    mockDb.patientCampaignRecipient.update.mockImplementation(
      async ({ data }: { data: unknown }) => ({ id: 1, ...(data as object) })
    );

    await updateRecipientStatus({ id: 1, status: "ACCEPTED" }, 7);

    const dataArg = mockDb.patientCampaignRecipient.update.mock.calls[0]![0].data;
    expect(dataArg.respondedAt).toBeInstanceOf(Date);
  });
});
