import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    patient: { findUnique: vi.fn() },
    clinicalSeries: { findUnique: vi.fn() },
    immunotherapyAdministration: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const {
  createImmunoAdministration,
  listImmunoAdministrationsByPatient,
  listAdverseReactions,
  markIspReported,
} = await import("../immunotherapy-administrations.ts");

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
    await expect(createImmunoAdministration(baseInput, 9)).rejects.toThrow(
      /Paciente no encontrado/
    );
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

describe("listAdverseReactions", () => {
  it("filters to systemic WAO >= 1 OR local reaction, and denormalizes patient name", async () => {
    mockDb.immunotherapyAdministration.findMany.mockResolvedValue([
      {
        id: "a1",
        patientId: 42,
        administeredAt: new Date("2026-06-15T10:00:00Z"),
        doseLabel: "Mantención",
        vialDescription: null,
        vialLot: null,
        injectionSite: "brazo_derecho",
        systemicReactionGrade: 2,
        hadLocalReaction: false,
        localReactionNote: null,
        reactionNote: "urticaria",
        reportedToIsp: false,
        ispReportedAt: null,
        ispNotes: null,
        patient: { person: { names: "Ana", fatherName: "Pérez", motherName: null } },
      },
    ]);
    const res = await listAdverseReactions();
    const where = mockDb.immunotherapyAdministration.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ systemicReactionGrade: { gte: 1 } }, { hadLocalReaction: true }]);
    expect(res.items[0]?.patientName).toBe("Ana Pérez");
    expect(res.items[0]?.systemicReactionGrade).toBe(2);
  });
});

describe("markIspReported", () => {
  it("throws NOT_FOUND when the record does not exist", async () => {
    mockDb.immunotherapyAdministration.findUnique.mockResolvedValue(null);
    await expect(markIspReported("nope", true)).rejects.toThrow(/Registro no encontrado/);
  });

  it("sets ispReportedAt when marking reported, null when unmarking", async () => {
    mockDb.immunotherapyAdministration.findUnique.mockResolvedValue({ id: "a1" });
    mockDb.immunotherapyAdministration.update.mockResolvedValue({
      id: "a1",
      patientId: 42,
      administeredAt: new Date(),
      doseLabel: null,
      vialDescription: null,
      vialLot: null,
      injectionSite: null,
      systemicReactionGrade: 1,
      hadLocalReaction: false,
      localReactionNote: null,
      reactionNote: null,
      reportedToIsp: true,
      ispReportedAt: new Date(),
      ispNotes: null,
      patient: { person: { names: "Ana", fatherName: null, motherName: null } },
    });

    await markIspReported("a1", true, "folio 123");
    const reported = mockDb.immunotherapyAdministration.update.mock.calls[0][0].data;
    expect(reported.reportedToIsp).toBe(true);
    expect(reported.ispReportedAt).toBeInstanceOf(Date);
    expect(reported.ispNotes).toBe("folio 123");

    await markIspReported("a1", false);
    const unreported = mockDb.immunotherapyAdministration.update.mock.calls[1][0].data;
    expect(unreported.reportedToIsp).toBe(false);
    expect(unreported.ispReportedAt).toBeNull();
  });
});
