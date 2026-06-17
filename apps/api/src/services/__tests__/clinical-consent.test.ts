import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    clinicalConsent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    patient: { findUnique: vi.fn() },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { listClinicalConsents, createClinicalConsent, decideClinicalConsent } =
  await import("../clinical-consent.ts");

const PATIENT = { person: { names: "Ada", fatherName: "Lovelace", motherName: null } };

const BASE_CREATE = {
  patientId: 5,
  procedureType: "SCIT" as const,
  procedureName: "Inmunoterapia subcutánea ácaros",
  templateVersion: "v1",
  contentSnapshot: "Texto del consentimiento concreto…",
  signatureMethod: "PRESENCIAL_FISICA" as const,
  signerName: "Ada Lovelace",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.clinicalConsent.findMany.mockResolvedValue([]);
  mockDb.patient.findUnique.mockResolvedValue({ id: 5 });
  mockDb.clinicalConsent.findUnique.mockResolvedValue({ id: "cc_1", status: "PENDING" });
  mockDb.clinicalConsent.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "cc_1",
      ...data,
      patient: PATIENT,
    })
  );
  mockDb.clinicalConsent.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "cc_1",
      patientId: 5,
      ...data,
      patient: PATIENT,
    })
  );
});

describe("listClinicalConsents", () => {
  it("orders by createdAt desc, includes patient, composes patientName", async () => {
    mockDb.clinicalConsent.findMany.mockResolvedValue([
      { id: "cc_1", patientId: 5, status: "SIGNED", patient: PATIENT },
    ]);
    const { consents } = await listClinicalConsents({});
    const call = mockDb.clinicalConsent.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    expect(call.where).toBeUndefined();
    expect(consents[0].patientName).toBe("Ada Lovelace");
    expect("patient" in consents[0]).toBe(false);
  });

  it("filters by patientId + status", async () => {
    await listClinicalConsents({ patientId: 5, status: "PENDING" });
    expect(mockDb.clinicalConsent.findMany.mock.calls[0][0].where).toEqual({
      patientId: 5,
      status: "PENDING",
    });
  });
});

describe("createClinicalConsent", () => {
  it("throws NOT_FOUND when patient missing", async () => {
    mockDb.patient.findUnique.mockResolvedValue(null);
    await expect(createClinicalConsent(BASE_CREATE, 9)).rejects.toThrow(/Paciente no encontrado/);
    expect(mockDb.clinicalConsent.create).not.toHaveBeenCalled();
  });

  it("creates PENDING with createdBy from session + content snapshot", async () => {
    await createClinicalConsent(BASE_CREATE, 9);
    const call = mockDb.clinicalConsent.create.mock.calls[0][0];
    expect(call.data.createdBy).toBe(9);
    expect(call.data.contentSnapshot).toBe("Texto del consentimiento concreto…");
    expect(call.data.risksDisclosed).toBeNull();
    expect(call.data.signerRut).toBeNull();
  });
});

describe("decideClinicalConsent", () => {
  it("throws NOT_FOUND when missing", async () => {
    mockDb.clinicalConsent.findUnique.mockResolvedValue(null);
    await expect(decideClinicalConsent({ id: "nope", status: "SIGNED" })).rejects.toThrow(
      /no encontrado/
    );
  });

  it("rejects deciding an already REVOKED consent", async () => {
    mockDb.clinicalConsent.findUnique.mockResolvedValue({ id: "cc_1", status: "REVOKED" });
    await expect(decideClinicalConsent({ id: "cc_1", status: "SIGNED" })).rejects.toThrow(
      /ya fue revocado/
    );
    expect(mockDb.clinicalConsent.update).not.toHaveBeenCalled();
  });

  it("SIGNED stamps signedAt", async () => {
    await decideClinicalConsent({ id: "cc_1", status: "SIGNED" });
    const call = mockDb.clinicalConsent.update.mock.calls[0][0];
    expect(call.data.status).toBe("SIGNED");
    expect(call.data.signedAt).toBeInstanceOf(Date);
    expect(call.data.revokedAt).toBeUndefined();
  });

  it("REVOKED stamps revokedAt", async () => {
    await decideClinicalConsent({ id: "cc_1", status: "REVOKED" });
    const call = mockDb.clinicalConsent.update.mock.calls[0][0];
    expect(call.data.status).toBe("REVOKED");
    expect(call.data.revokedAt).toBeInstanceOf(Date);
  });

  it("REFUSED stores the reason", async () => {
    await decideClinicalConsent({ id: "cc_1", status: "REFUSED", refusedReason: "Paciente declina" });
    const call = mockDb.clinicalConsent.update.mock.calls[0][0];
    expect(call.data.status).toBe("REFUSED");
    expect(call.data.refusedReason).toBe("Paciente declina");
  });
});
