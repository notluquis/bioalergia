import { beforeEach, describe, expect, it, vi } from "vitest";

// Characterization tests for prescription logic moved OUT of the oRPC handler:
//  - createMedicalPrescription: patient NOT_FOUND, folio allocation order
//    (nextval → buildFolio), JSON-safe row, verification, supersede annul.
//  - listMedicalPrescriptions: where-builder (range / search / status / patient).

const { mockDb, mockKysely } = vi.hoisted(() => {
  const mockDb = {
    patient: { findUnique: vi.fn() },
    clinicSettings: { upsert: vi.fn() },
    medicalPrescription: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  const mockKysely = {};
  return { mockDb, mockKysely };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: mockKysely }));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    sqlExecute: vi.fn(),
    createVerification: vi.fn(),
    generateVerificationCode: vi.fn(),
  },
}));

// kysely `sql` tagged template → capture the executed query, return the seq row.
vi.mock("kysely", () => ({
  sql: () => ({ execute: mocks.sqlExecute }),
}));

vi.mock("../verification.ts", () => ({
  createVerification: mocks.createVerification,
  generateVerificationCode: mocks.generateVerificationCode,
}));

import { DomainError } from "../../lib/errors.ts";
import { createMedicalPrescription, listMedicalPrescriptions } from "../prescriptions.ts";

const validInput = {
  patientId: 7,
  date: "2026-06-10",
  medications: [{ name: "Loratadina", dosage: "10mg" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateVerificationCode.mockReturnValue("BA-CCCC-DDDD");
  mocks.sqlExecute.mockResolvedValue({ rows: [{ v: 123 }] });
  mockDb.clinicSettings.upsert.mockResolvedValue({ superintendenciaNumber: "55555" });
  mockDb.medicalPrescription.create.mockResolvedValue({});
  mocks.createVerification.mockResolvedValue("BA-CCCC-DDDD");
});

describe("createMedicalPrescription", () => {
  it("throws NOT_FOUND when patient is missing (before any create)", async () => {
    mockDb.patient.findUnique.mockResolvedValue(null);
    await expect(createMedicalPrescription(validInput, 1)).rejects.toMatchObject({
      kind: "NOT_FOUND",
    });
    expect(mockDb.medicalPrescription.create).not.toHaveBeenCalled();
  });

  it("allocates folio from sequence then persists JSON-safe row + verification", async () => {
    mockDb.patient.findUnique.mockResolvedValue({
      person: { names: "Juan", fatherName: "Pérez", motherName: "Soto", rut: "12.345.678-9" },
    });

    const out = await createMedicalPrescription(validInput, 99);

    // folio: nextval BEFORE create (auditable correlativo).
    expect(mocks.sqlExecute).toHaveBeenCalledTimes(1);
    const created = mockDb.medicalPrescription.create.mock.calls[0][0].data;
    expect(created.folioSeq).toBe(123);
    expect(created.folio).toMatch(/^RX-2026-000123-[0-9A-Z]{4}$/);
    expect(created.doctorLicense).toBe("55555");
    expect(created.issuedBy).toBe(99);
    expect(created.patientName).toBe("Juan Pérez Soto");
    expect(created.patientRut).toBe("12.345.678-9");
    // medications normalized (no undefined keys).
    expect(created.medications).toEqual([{ name: "Loratadina", dosage: "10mg" }]);
    // metadata JSON-safe: absent optionals → null, never undefined.
    expect(JSON.stringify(created.metadata)).not.toContain("undefined");
    expect(created.metadata.patientName).toBe("Juan Pérez Soto");

    expect(mocks.createVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: "prescription",
        prescriptionId: created.id,
        code: "BA-CCCC-DDDD",
      })
    );
    expect(out).toEqual({ id: created.id });
  });

  it("annuls the superseded prescription after creating the new one (re-issue)", async () => {
    mockDb.patient.findUnique.mockResolvedValue({
      person: { names: "Ana", fatherName: null, motherName: null, rut: null },
    });
    mockDb.medicalPrescription.findUnique.mockResolvedValue({ id: "old", status: "ISSUED" });
    mockDb.medicalPrescription.update.mockResolvedValue({ id: "old", status: "ANNULLED" });

    await createMedicalPrescription({ ...validInput, supersedesId: "old" }, 1);

    // new prescription created, THEN old annulled.
    expect(mockDb.medicalPrescription.create).toHaveBeenCalled();
    expect(mockDb.medicalPrescription.update).toHaveBeenCalledWith({
      where: { id: "old" },
      data: { status: "ANNULLED" },
      select: { id: true, status: true },
    });
  });

  it("does NOT fail the emission if annulling the superseded one throws", async () => {
    mockDb.patient.findUnique.mockResolvedValue({
      person: { names: "Ana", fatherName: null, motherName: null, rut: null },
    });
    // superseded already annulled → annulPrescription throws CONFLICT; swallowed.
    mockDb.medicalPrescription.findUnique.mockResolvedValue({ id: "old", status: "ANNULLED" });

    const out = await createMedicalPrescription({ ...validInput, supersedesId: "old" }, 1);
    expect(out).toMatchObject({ id: expect.any(String) });
  });
});

describe("listMedicalPrescriptions", () => {
  beforeEach(() => {
    mockDb.medicalPrescription.findMany.mockResolvedValue([{ id: "p1" }]);
  });

  it("returns { items }, default take 200, order issuedAt desc, includes patient.person", async () => {
    const out = await listMedicalPrescriptions(undefined);
    expect(out).toEqual({ items: [{ id: "p1" }] });
    expect(mockDb.medicalPrescription.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { issuedAt: "desc" },
      take: 200,
      include: { patient: { include: { person: true } } },
    });
  });

  it("filters by patientId + status", async () => {
    await listMedicalPrescriptions({ patientId: 5, status: "ANNULLED" });
    const arg = mockDb.medicalPrescription.findMany.mock.calls[0][0];
    expect(arg.where.patientId).toBe(5);
    expect(arg.where.status).toBe("ANNULLED");
  });

  it("date range targets `date` when dateField=date, `issuedAt` otherwise", async () => {
    await listMedicalPrescriptions({ from: "2026-01-01", dateField: "date" });
    expect(mockDb.medicalPrescription.findMany.mock.calls[0][0].where.date).toBeDefined();

    mockDb.medicalPrescription.findMany.mockClear();
    await listMedicalPrescriptions({ from: "2026-01-01" });
    expect(mockDb.medicalPrescription.findMany.mock.calls[0][0].where.issuedAt).toBeDefined();
  });

  it("search builds OR over name/rut/diagnosis/medications(json)", async () => {
    await listMedicalPrescriptions({ search: " amox " });
    const arg = mockDb.medicalPrescription.findMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual([
      { patientName: { contains: "amox", mode: "insensitive" } },
      { patientRut: { contains: "amox", mode: "insensitive" } },
      { diagnosis: { contains: "amox", mode: "insensitive" } },
      { medications: { string_contains: "amox" } },
    ]);
  });
});
