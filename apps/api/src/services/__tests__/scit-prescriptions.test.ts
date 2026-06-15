import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    patient: { findUnique: vi.fn() },
    scitPrescription: { create: vi.fn(), findMany: vi.fn() },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { createScitPrescription, listScitPrescriptionsByPatient } =
  await import("../scit-prescriptions.ts");

const baseInput = {
  patientId: 42,
  provider: "roxall",
  inputs: { selectedAllergenIds: ["alternaria"], provider: "roxall" },
  vials: [{ vialNumber: 1, label: "Modigoid" }],
  rulesApplied: ["Regla 5: Hongos aislados"],
  summary: "1 alérgeno → 1 vial",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.patient.findUnique.mockResolvedValue({
    person: { names: "Ana", fatherName: "Pérez", motherName: "Soto", rut: "11.111.111-1" },
  });
  mockDb.scitPrescription.create.mockResolvedValue({ id: "scit_1" });
  mockDb.scitPrescription.findMany.mockResolvedValue([]);
});

describe("createScitPrescription", () => {
  it("throws NOT_FOUND when the patient does not exist", async () => {
    mockDb.patient.findUnique.mockResolvedValue(null);
    await expect(createScitPrescription(baseInput, 7)).rejects.toThrow(/Paciente no encontrado/);
    expect(mockDb.scitPrescription.create).not.toHaveBeenCalled();
  });

  it("denormalizes patient name/rut, stamps createdBy, returns id", async () => {
    const res = await createScitPrescription(baseInput, 7);
    expect(res).toEqual({ id: "scit_1" });
    const data = mockDb.scitPrescription.create.mock.calls[0][0].data;
    expect(data.patientName).toBe("Ana Pérez Soto");
    expect(data.patientRut).toBe("11.111.111-1");
    expect(data.createdBy).toBe(7);
    expect(data.provider).toBe("roxall");
    expect(data.rulesApplied).toEqual(["Regla 5: Hongos aislados"]);
  });

  it("omits alerts when not provided (Json rejects undefined)", async () => {
    await createScitPrescription(baseInput, 7);
    const data = mockDb.scitPrescription.create.mock.calls[0][0].data;
    expect("alerts" in data).toBe(false);
  });

  it("includes alerts when provided", async () => {
    await createScitPrescription({ ...baseInput, alerts: [{ severity: "warning" }] }, 7);
    const data = mockDb.scitPrescription.create.mock.calls[0][0].data;
    expect(data.alerts).toEqual([{ severity: "warning" }]);
  });
});

describe("listScitPrescriptionsByPatient", () => {
  it("queries by patient, newest first, capped at 100", async () => {
    await listScitPrescriptionsByPatient(42);
    expect(mockDb.scitPrescription.findMany).toHaveBeenCalledWith({
      where: { patientId: 42 },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });
});
