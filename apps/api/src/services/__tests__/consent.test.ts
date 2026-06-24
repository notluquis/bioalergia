import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    consentRecord: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    person: {
      findUnique: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { listConsentRecords, recordConsent, withdrawConsent } = await import("../consent.ts");

const PERSON = { names: "Juana", fatherName: "Pérez", motherName: "Soto", email: "j@x.cl" };

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.consentRecord.findMany.mockResolvedValue([]);
  mockDb.person.findUnique.mockResolvedValue({ id: 7 });
  mockDb.consentRecord.findUnique.mockResolvedValue({ id: "c_1", status: "GRANTED" });
  mockDb.consentRecord.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "c_1",
      ...data,
      person: PERSON,
    })
  );
  mockDb.consentRecord.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "c_1",
      personId: 7,
      ...data,
      person: PERSON,
    })
  );
});

describe("listConsentRecords", () => {
  it("lists ordered by grantedAt desc with person include, no filters", async () => {
    await listConsentRecords({});
    const call = mockDb.consentRecord.findMany.mock.calls[0][0];
    expect(call.where).toBeUndefined();
    expect(call.orderBy).toEqual({ grantedAt: "desc" });
    expect(call.include.person.select).toMatchObject({ names: true, email: true });
  });

  it("applies filters when provided", async () => {
    await listConsentRecords({ personId: 7, purpose: "MARKETING_EMAIL", status: "GRANTED" });
    const call = mockDb.consentRecord.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ personId: 7, purpose: "MARKETING_EMAIL", status: "GRANTED" });
  });

  it("composes personName + personEmail from the included person", async () => {
    mockDb.consentRecord.findMany.mockResolvedValue([
      { id: "c_1", personId: 7, purpose: "RESEARCH", status: "GRANTED", person: PERSON },
    ]);
    const { records } = await listConsentRecords({});
    expect(records[0].personName).toBe("Juana Pérez Soto");
    expect(records[0].personEmail).toBe("j@x.cl");
    expect("person" in records[0]).toBe(false);
  });
});

describe("recordConsent", () => {
  it("throws NOT_FOUND when the person does not exist", async () => {
    mockDb.person.findUnique.mockResolvedValue(null);
    await expect(
      recordConsent(
        { personId: 999, purpose: "MARKETING_EMAIL", channel: "WEB", policyVersion: "v1" },
        3
      )
    ).rejects.toThrow(/Persona no encontrada/);
    expect(mockDb.consentRecord.create).not.toHaveBeenCalled();
  });

  it("creates a GRANTED record stamping recordedBy from the session (not the client)", async () => {
    await recordConsent(
      { personId: 7, purpose: "MARKETING_EMAIL", channel: "PRESENCIAL", policyVersion: "v2" },
      42
    );
    const call = mockDb.consentRecord.create.mock.calls[0][0];
    expect(call.data.recordedBy).toBe(42);
    expect(call.data.personId).toBe(7);
    expect(call.data.policyVersion).toBe("v2");
    expect(call.data.evidenceText).toBeNull();
  });
});

describe("withdrawConsent", () => {
  it("throws NOT_FOUND when missing", async () => {
    mockDb.consentRecord.findUnique.mockResolvedValue(null);
    await expect(withdrawConsent("nope")).rejects.toThrow(/no encontrado/);
    expect(mockDb.consentRecord.update).not.toHaveBeenCalled();
  });

  it("rejects re-withdrawing an already WITHDRAWN consent", async () => {
    mockDb.consentRecord.findUnique.mockResolvedValue({ id: "c_1", status: "WITHDRAWN" });
    await expect(withdrawConsent("c_1")).rejects.toThrow(/ya fue revocado/);
    expect(mockDb.consentRecord.update).not.toHaveBeenCalled();
  });

  it("sets status WITHDRAWN + withdrawnAt", async () => {
    await withdrawConsent("c_1");
    const call = mockDb.consentRecord.update.mock.calls[0][0];
    expect(call.data.status).toBe("WITHDRAWN");
    expect(call.data.withdrawnAt).toBeInstanceOf(Date);
  });
});
