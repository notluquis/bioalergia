import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    patient: { findUnique: vi.fn() },
    clinicalSeries: { findUnique: vi.fn() },
    immunotherapyAdministration: { create: vi.fn(), findMany: vi.fn() },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { createImmunoAdministration, listImmunoAdministrationsByPatient } = await import(
  "../immunotherapy-administrations.ts"
);

const baseInput = {
  patientId: 42,
  administeredAt: new Date("2026-06-15T15:00:00Z"),
  doseLabel: "Mantención",
  doseMl: 0.5,
  injectionSite: "brazo_derecho" as const,
  observationMinutes: 30,
  observationCompleted: true,
  hadLocalReaction: false,
  systemicReactionGrade: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.patient.findUnique.mockResolvedValue({ id: 42 });
  mockDb.clinicalSeries.findUnique.mockResolvedValue({ id: 7 });
  mockDb.immunotherapyAdministration.create.mockResolvedValue({ id: "adm_1" });
  mockDb.immunotherapyAdministration.findMany.mockResolvedValue([]);
});

describe("createImmunoAdministration", () => {
  it("throws NOT_FOUND when the patient does not exist", async () => {
    mockDb.patient.findUnique.mockResolvedValue(null);
    await expect(createImmunoAdministration(baseInput, 9)).rejects.toThrow(/Paciente no encontrado/);
    expect(mockDb.immunotherapyAdministration.create).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when a referenced clinical series does not exist", async () => {
    mockDb.clinicalSeries.findUnique.mockResolvedValue(null);
    await expect(
      createImmunoAdministration({ ...baseInput, clinicalSeriesId: 99 }, 9)
    ).rejects.toThrow(/Serie clínica no encontrada/);
  });

  it("stamps administeredBy and returns id", async () => {
    const res = await createImmunoAdministration(baseInput, 9);
    expect(res).toEqual({ id: "adm_1" });
    const data = mockDb.immunotherapyAdministration.create.mock.calls[0][0].data;
    expect(data.administeredBy).toBe(9);
    expect(data.injectionSite).toBe("brazo_derecho");
    expect(data.systemicReactionGrade).toBe(0);
    expect(data.observationCompleted).toBe(true);
  });

  it("normalizes optional ids to null", async () => {
    await createImmunoAdministration(baseInput, 9);
    const data = mockDb.immunotherapyAdministration.create.mock.calls[0][0].data;
    expect(data.clinicalSeriesId).toBeNull();
    expect(data.eventId).toBeNull();
  });
});

describe("listImmunoAdministrationsByPatient", () => {
  it("queries by patient, newest first, capped at 200", async () => {
    await listImmunoAdministrationsByPatient(42);
    expect(mockDb.immunotherapyAdministration.findMany).toHaveBeenCalledWith({
      where: { patientId: 42 },
      orderBy: { administeredAt: "desc" },
      take: 200,
    });
  });
});
