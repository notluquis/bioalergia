import { PDFDocument, PDFName } from "pdf-lib";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import {
  generateMedicalPrescriptionPdf,
  type MedicalPrescriptionPdfInput,
} from "./certificate.service.ts";

const baseInput: MedicalPrescriptionPdfInput = {
  patientId: 1,
  date: "2026-06-09",
  prescriptionType: "SIMPLE",
  patientAge: 54,
  folio: "RX-2026-000123-7K2M",
  diagnosis: "Rinitis alérgica persistente (CIE-11: CA08.0)",
  medications: [
    {
      name: "Loratadina 10 mg",
      dosage: "10 mg, vía oral",
      frequency: "cada 24 horas",
      duration: "30 días",
    },
  ],
  doctorName: "Dr. Test",
  doctorSpecialty: "Alergología",
  doctorRut: "11.111.111-1",
  doctorLicense: "15651",
  patient: { name: "Paciente Prueba", rut: "20.275.995-5" },
};

// Sin logoUrls → cae a fallback local; embebe %PDF válido igualmente.
async function render(input: MedicalPrescriptionPdfInput): Promise<Uint8Array> {
  return generateMedicalPrescriptionPdf(input);
}

describe("generateMedicalPrescriptionPdf", () => {
  it("produces a valid PDF (half-letter, single page for one med)", async () => {
    const bytes = await render(baseInput);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(396);
    expect(Math.round(height)).toBe(612);
  });

  it("paginates when many medications overflow", async () => {
    const bytes = await render({
      ...baseInput,
      medications: Array.from({ length: 8 }, (_, i) => ({
        name: `Medicamento largo de prueba número ${i + 1}`,
        dosage: "2 inhalaciones, vía inhalatoria",
        frequency: "cada 12 horas",
        duration: "90 días",
        instructions:
          "Enjuagar la boca después de cada uso. Indicaciones largas para forzar el wrap.",
      })),
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    // toda página media-carta mantiene el tamaño.
    for (const page of doc.getPages()) {
      expect(Math.round(page.getSize().width)).toBe(396);
    }
  });

  it("renders annulled (watermark path) without throwing", async () => {
    const bytes = await render({ ...baseInput, status: "ANNULLED" });
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("embeds a tagged QR link + verification code when provided", async () => {
    const qr = await QRCode.toBuffer("https://intranet.bioalergia.cl/verificar/BA-7K2M-9XQ4");
    const bytes = await render({
      ...baseInput,
      qrCodeBuffer: qr,
      verificationCode: "BA-7K2M-9XQ4",
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);

    expect(doc.catalog.get(PDFName.of("StructTreeRoot"))?.toString()).toMatch(/^\d+ 0 R$/);
    expect(doc.catalog.get(PDFName.of("MarkInfo"))?.toString()).toContain("/Marked true");

    const metadataRef = doc.catalog.get(PDFName.of("Metadata"));
    expect(metadataRef).toBeDefined();
    const metadata = doc.context.lookup(metadataRef as never) as {
      getContentsString?: () => string;
    };
    const xmp = metadata.getContentsString?.() ?? "";
    expect(xmp).toContain("<pdfaid:part>3</pdfaid:part>");
    expect(xmp).toContain("<pdfaid:conformance>A</pdfaid:conformance>");
    expect(xmp).toContain("<pdfuaid:part>1</pdfuaid:part>");

    const page = doc.getPage(0);
    expect(page.node.get(PDFName.of("Tabs"))?.toString()).toBe("/S");
    const annots = page.node.lookup(PDFName.of("Annots")) as unknown as {
      get: (index: number) => unknown;
      size: () => number;
    };
    expect(annots.size()).toBe(1);
    const annot = doc.context.lookup(annots.get(0) as never) as unknown as {
      get: (key: PDFName) => unknown;
      lookup: (key: PDFName) => { decodeText?: () => string; toString: () => string };
    };
    expect(annot.get(PDFName.of("Subtype"))?.toString()).toBe("/Link");
    expect(annot.get(PDFName.of("StructParent"))?.toString()).toMatch(/^\d+$/);

    const action = annot.lookup(PDFName.of("A")) as {
      lookup: (key: PDFName) => { decodeText?: () => string; toString: () => string };
    };
    expect(action.lookup(PDFName.of("URI")).decodeText?.()).toBe(
      "https://bioalergia.cl/verificar/BA-7K2M-9XQ4"
    );
    const contents = annot.lookup(PDFName.of("Contents")).decodeText?.() ?? "";
    expect(contents).toBe("Código QR - verificar autenticidad en bioalergia.cl");
    expect(contents).not.toMatch(/[\u0000-\u001f]/);
  });

  it("renders blank template (mode=template) and overlay (mode=overlay)", async () => {
    const template = await render({ ...baseInput, mode: "template" });
    const overlay = await render({ ...baseInput, mode: "overlay" });
    expect(Buffer.from(template.slice(0, 5)).toString()).toBe("%PDF-");
    expect(Buffer.from(overlay.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("handles missing rut / age gracefully", async () => {
    const bytes = await render({
      ...baseInput,
      patientAge: undefined,
      patient: { name: "Sin Datos", rut: null },
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
