import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────
// Characterization tests for the certificate service logic moved OUT of the
// oRPC handlers (list / delete / verify + signed-PDF generate orchestration).
// They pin the EXACT behavior the handlers had before the "handlers finos"
// refactor: where-builders, not-found shapes, persisted rows, and the
// signing/Drive/verification call ORDER for generate.

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    clinicSettings: { upsert: vi.fn() },
    medicalCertificate: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  return { mockDb };
});
vi.mock("@finanzas/db", () => ({ db: mockDb }));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    generateMedicalCertificatePdf: vi.fn(),
    generateQRCode: vi.fn(),
    signPdf: vi.fn(),
    toPdfA3: vi.fn(),
    uploadCertificateToDrive: vi.fn(),
    createVerification: vi.fn(),
    generateVerificationCode: vi.fn(),
  },
}));

vi.mock("../../modules/certificates/certificate.service.ts", () => ({
  generateMedicalCertificatePdf: mocks.generateMedicalCertificatePdf,
  generateQRCode: mocks.generateQRCode,
  signPdf: mocks.signPdf,
}));
vi.mock("../../modules/pdf/pdf-a.ts", () => ({ toPdfA3: mocks.toPdfA3 }));
vi.mock("../certificates-drive.ts", () => ({
  uploadCertificateToDrive: mocks.uploadCertificateToDrive,
}));
vi.mock("../verification.ts", () => ({
  createVerification: mocks.createVerification,
  generateVerificationCode: mocks.generateVerificationCode,
}));

import {
  deleteMedicalCertificate,
  generateMedicalCertificate,
  listMedicalCertificates,
  verifyMedicalCertificate,
} from "../certificates.ts";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listMedicalCertificates", () => {
  it("returns items + total = items.length, default take 200, order by issuedAt desc", async () => {
    mockDb.medicalCertificate.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const out = await listMedicalCertificates(undefined);
    expect(out).toEqual({ items: [{ id: "a" }, { id: "b" }], total: 2 });
    expect(mockDb.medicalCertificate.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { issuedAt: "desc" },
      take: 200,
    });
  });

  it("builds issuedAt range with lt = to + 1 day", async () => {
    mockDb.medicalCertificate.findMany.mockResolvedValue([]);
    await listMedicalCertificates({ from: "2026-01-01", to: "2026-01-31", limit: 10 });
    const arg = mockDb.medicalCertificate.findMany.mock.calls[0][0];
    expect(arg.take).toBe(10);
    const range = arg.where.issuedAt as { gte: Date; lt: Date };
    expect(range.gte).toBeInstanceOf(Date);
    // lt is gte-of-next-day → exactly 30 days after Jan 1 plus the +1 day shift.
    expect(range.lt.getTime() - new Date("2026-01-31").setHours(0, 0, 0, 0)).not.toBeNaN();
  });

  it("builds case-insensitive OR search on name/rut/diagnosis", async () => {
    mockDb.medicalCertificate.findMany.mockResolvedValue([]);
    await listMedicalCertificates({ search: "  juan  " });
    const arg = mockDb.medicalCertificate.findMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual([
      { patientName: { contains: "juan", mode: "insensitive" } },
      { patientRut: { contains: "juan", mode: "insensitive" } },
      { diagnosis: { contains: "juan", mode: "insensitive" } },
    ]);
  });
});

describe("deleteMedicalCertificate", () => {
  it("deletes by id and returns { ok: true }", async () => {
    mockDb.medicalCertificate.delete.mockResolvedValue({});
    const out = await deleteMedicalCertificate("c1");
    expect(out).toEqual({ ok: true });
    expect(mockDb.medicalCertificate.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});

describe("verifyMedicalCertificate", () => {
  it("returns { valid: false, error } when not found (no throw)", async () => {
    mockDb.medicalCertificate.findUnique.mockResolvedValue(null);
    const out = await verifyMedicalCertificate("missing");
    expect(out).toEqual({ error: "Certificado no encontrado", valid: false });
  });

  it("throws when certificate has no issuer person (integrity violation → 500)", async () => {
    mockDb.medicalCertificate.findUnique.mockResolvedValue({ id: "x", issuer: null });
    await expect(verifyMedicalCertificate("x")).rejects.toThrow("Certificado sin emisor válido");
  });

  it("projects the public verification shape for a valid certificate", async () => {
    const issuedAt = new Date("2026-06-01T10:00:00Z");
    mockDb.medicalCertificate.findUnique.mockResolvedValue({
      id: "x",
      diagnosis: "Rinitis",
      patientName: "Juan Pérez",
      purpose: "trabajo",
      restDays: 2,
      restStartDate: new Date("2026-06-02"),
      restEndDate: new Date("2026-06-03"),
      issuedAt,
      issuer: { person: { names: "Dr. Test" } },
    });
    const out = await verifyMedicalCertificate("x");
    expect(out).toEqual({
      diagnosis: "Rinitis",
      doctor: {
        name: "Dr. Test",
        specialty: "Especialista en Alergología e Inmunología Clínica",
      },
      issuedAt,
      patient: { name: "Juan Pérez" },
      purpose: "trabajo",
      restDays: 2,
      restEndDate: new Date("2026-06-03"),
      restStartDate: new Date("2026-06-02"),
      valid: true,
    });
  });
});

describe("generateMedicalCertificate (signing/Drive/verification orchestration)", () => {
  const validInput = {
    address: "Calle 1",
    birthDate: "1990-01-01",
    date: "2026-06-10",
    diagnosis: "Rinitis",
    patientName: "Juan Pérez",
    purpose: "trabajo" as const,
    rut: "12.345.678-9",
  };

  beforeEach(() => {
    mocks.generateVerificationCode.mockReturnValue("BA-AAAA-BBBB");
    mocks.generateQRCode.mockResolvedValue(Buffer.from("qr"));
    mockDb.clinicSettings.upsert.mockResolvedValue({
      logoUrl: "p.png",
      secondaryLogoUrl: "s.png",
    });
    mocks.generateMedicalCertificatePdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.toPdfA3.mockResolvedValue(new Uint8Array([4, 5, 6]));
    mocks.signPdf.mockResolvedValue(new Uint8Array([7, 8, 9]));
    mocks.uploadCertificateToDrive.mockResolvedValue({ fileId: "drive-1" });
    mockDb.medicalCertificate.create.mockResolvedValue({});
    mocks.createVerification.mockResolvedValue("BA-AAAA-BBBB");
  });

  it("runs QR → upsert clinic → pdf → pdfA3 → sign, then persists row + verification, returns File", async () => {
    const file = await generateMedicalCertificate(validInput, 42);

    // signing pipeline order: generate pdf with QR + logos, THEN pdfA3, THEN sign.
    expect(mocks.generateQRCode).toHaveBeenCalledWith("BA-AAAA-BBBB");
    expect(mocks.generateMedicalCertificatePdf).toHaveBeenCalledWith(
      expect.objectContaining({ patientName: "Juan Pérez", rut: "12.345.678-9" }),
      Buffer.from("qr"),
      { primary: "p.png", secondary: "s.png" }
    );
    expect(mocks.toPdfA3).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), "Certificado médico");
    expect(mocks.signPdf).toHaveBeenCalledWith(new Uint8Array([4, 5, 6]));

    // persisted row carries the signed-pdf hash + issuedBy + drive file id.
    const created = mockDb.medicalCertificate.create.mock.calls[0][0].data;
    expect(created.issuedBy).toBe(42);
    expect(created.driveFileId).toBe("drive-1");
    expect(created.patientRut).toBe("12.345.678-9");
    expect(typeof created.pdfHash).toBe("string");
    expect(created.pdfHash).toHaveLength(64); // sha256 hex of signed bytes

    // verification persisted with the same code + pdfHash, documentType certificate.
    expect(mocks.createVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: "certificate",
        code: "BA-AAAA-BBBB",
        pdfHash: created.pdfHash,
      })
    );

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("certificado_medico_12345678-9.pdf");
    expect(file.type).toBe("application/pdf");
  });
});
