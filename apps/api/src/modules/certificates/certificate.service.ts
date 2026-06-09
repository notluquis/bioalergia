import fs from "node:fs";
import path from "node:path";
import { PDFDocument, type PDFFont, rgb } from "pdf-lib";
import QRCode from "qrcode";

import { formatChileLongDate, formatChileShortDate } from "../../lib/time.ts";
import { drawImageTopLeft, embedLogo, loadPdfFonts, setPdfMetadata } from "../pdf/pdf-base.ts";
import type { MedicalCertificateInput, MedicalPrescriptionInput } from "./certificate.schema.ts";
import { defaultDoctorInfo } from "./certificate.schema.ts";

/** URLs administrables de logos (ClinicSettings). Vacío → fallback local. */
export type CertificateLogoUrls = { primary?: string | null; secondary?: string | null };

// Paths to assets
const ASSETS_DIR = path.resolve(import.meta.dirname, "../../../assets");
const SIGNATURES_DIR = path.join(ASSETS_DIR, "signatures");

const createDoctorInfo = (
  input: Pick<
    MedicalCertificateInput | MedicalPrescriptionInput,
    "doctorAddress" | "doctorEmail" | "doctorName" | "doctorRut" | "doctorSpecialty"
  >
) => ({
  name: input.doctorName || defaultDoctorInfo.name,
  specialty: input.doctorSpecialty || defaultDoctorInfo.specialty,
  title: defaultDoctorInfo.title,
  rut: input.doctorRut || defaultDoctorInfo.rut,
  email: input.doctorEmail || defaultDoctorInfo.email,
  address: input.doctorAddress || defaultDoctorInfo.address,
});

const drawHeaderLogos = async (
  pdfDoc: PDFDocument,
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  margin: number,
  width: number,
  y: number,
  logoUrls?: CertificateLogoUrls,
  primaryWidth = 165,
  secondaryWidth = 110
) => {
  // Logo Bioalergia (izquierda): URL administrable o fallback local.
  const primary = await embedLogo(pdfDoc, logoUrls?.primary, "bioalergia.png");
  if (primary) drawImageTopLeft(page, primary, { x: margin, topY: y, targetWidth: primaryWidth });

  // Logo AAAEIC (derecha): URL administrable o fallback local.
  const secondary = await embedLogo(pdfDoc, logoUrls?.secondary, "aaaeic.png");
  if (secondary) {
    drawImageTopLeft(page, secondary, {
      x: width - margin,
      topY: y,
      targetWidth: secondaryWidth,
      alignRight: true,
    });
  }
};

const drawPatientInfo = (
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  font: PDFFont,
  margin: number,
  startY: number,
  input: MedicalCertificateInput
) => {
  const patientInfo = [
    `Nombre Completo: ${input.patientName}`,
    `RUT: ${input.rut}`,
    `Fecha de Nacimiento: ${formatDate(input.birthDate)}`,
    `Domicilio: ${input.address}`,
    `Fecha: ${formatDate(input.date)}`,
  ];

  let y = startY;
  for (const line of patientInfo) {
    page.drawText(line, { x: margin, y, size: 10, font });
    y -= 16;
  }

  return y;
};

const drawBodyParagraphs = (
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  font: PDFFont,
  margin: number,
  width: number,
  startY: number,
  paragraphs: string[]
) => {
  let y = startY;
  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph, font, 10, width - 2 * margin);
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size: 10, font });
      y -= 14;
    }
    y -= 10;
  }

  return y;
};

const drawWatermark = (
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  font: PDFFont,
  width: number,
  height: number,
  date: string
) => {
  const watermarkText = `Válido ${formatChileShortDate(date)}`;
  page.drawText(watermarkText, {
    x: width / 2 - 100,
    y: height / 2,
    size: 48,
    font,
    color: rgb(0.9, 0.9, 0.9),
    opacity: 0.3,
  });
};

const drawDoctorFooter = (
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  doctor: ReturnType<typeof createDoctorInfo>,
  font: PDFFont,
  boldFont: PDFFont,
  margin: number,
  startY: number
) => {
  let y = startY;
  page.drawText(doctor.name, {
    x: margin,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.1, 0.4, 0.6),
  });
  y -= 14;
  page.drawText(doctor.specialty, { x: margin, y, size: 9, font, color: rgb(0.1, 0.4, 0.6) });
  y -= 12;
  page.drawText(doctor.title, { x: margin, y, size: 9, font, color: rgb(0.1, 0.4, 0.6) });
  y -= 12;
  page.drawText(`RUT: ${doctor.rut}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.1, 0.4, 0.6),
  });
  y -= 12;
  page.drawText(doctor.email, { x: margin, y, size: 9, font, color: rgb(0.1, 0.4, 0.6) });
  y -= 12;
  page.drawText(doctor.address, { x: margin, y, size: 9, font, color: rgb(0.1, 0.4, 0.6) });
};

const drawFooterNote = (
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  font: PDFFont,
  width: number
) => {
  page.drawText("Válida solo con firma y timbre", {
    x: width / 2 - font.widthOfTextAtSize("Válida solo con firma y timbre", 9) / 2,
    y: 50,
    size: 9,
    font,
    color: rgb(0.1, 0.4, 0.6),
  });
};

const drawQrCode = async (
  pdfDoc: PDFDocument,
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  qrCodeBuffer: Buffer,
  width: number
) => {
  try {
    const qrImage = await pdfDoc.embedPng(qrCodeBuffer);
    const qrDims = qrImage.scale(0.3);
    page.drawImage(qrImage, {
      x: width - qrDims.width - 30,
      y: 30,
      width: qrDims.width,
      height: qrDims.height,
    });
  } catch (error) {
    console.warn("Could not embed QR code:", error);
  }
};

/**
 * Generate QR code for certificate verification
 */
export async function generateQRCode(certificateId: string): Promise<Buffer> {
  const verifyUrl = `${process.env.APP_URL || "http://localhost:5173"}/verify/${certificateId}`;
  return await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: "M",
    type: "png",
    width: 200,
    margin: 1,
  });
}

/**
 * Generate a medical certificate PDF
 */
export async function generateMedicalCertificatePdf(
  input: MedicalCertificateInput,
  qrCodeBuffer?: Buffer,
  logoUrls?: CertificateLogoUrls
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // Fuente embebida (IBM Plex Sans, subset) — portabilidad/PDF-A.
  const { font: helvetica, bold: helveticaBold } = await loadPdfFonts(pdfDoc);
  setPdfMetadata(pdfDoc, {
    title: "Certificado médico",
    subject: "Certificado médico",
    author: createDoctorInfo(input).name,
    keywords: ["certificado", "médico", input.patientName],
  });

  const margin = 50;
  let y = height - margin;

  // --- HEADER: Logos ---
  await drawHeaderLogos(pdfDoc, page, margin, width, y, logoUrls);

  y -= 80;

  // --- TITLE ---
  const title = "Certificado médico";
  page.drawText(title, {
    x: width / 2 - helveticaBold.widthOfTextAtSize(title, 14) / 2,
    y,
    size: 14,
    font: helveticaBold,
    color: rgb(0.1, 0.4, 0.6),
  });

  y -= 30;

  // --- PATIENT INFO ---
  y = drawPatientInfo(page, helvetica, margin, y, input);

  y -= 20;

  // --- BODY TEXT ---
  const bodyParagraphs = generateBodyText(input);
  y = drawBodyParagraphs(page, helvetica, margin, width, y, bodyParagraphs);

  // --- WATERMARK ---
  drawWatermark(page, helveticaBold, width, height, input.date);

  // --- FOOTER: Doctor Info ---
  const doctor = createDoctorInfo(input);
  drawDoctorFooter(page, doctor, helvetica, helveticaBold, margin, 150);

  // --- SIGNATURE PLACEHOLDER ---
  page.drawText("FIRMA", {
    x: width - margin - 80,
    y: 100,
    size: 10,
    font: helveticaBold,
  });

  // --- QR CODE ---
  if (qrCodeBuffer) {
    await drawQrCode(pdfDoc, page, qrCodeBuffer, width);
  }

  // --- FOOTER TEXT ---
  drawFooterNote(page, helvetica, width);

  return await pdfDoc.save();
}

export type MedicalPrescriptionPdfInput = MedicalPrescriptionInput & {
  patient: {
    name: string;
    rut: string | null;
  };
  // Derivados server-side (no input del médico).
  folio?: string;
  doctorLicense?: string;
};

const PRESCRIPTION_TYPE_LABEL: Record<string, string> = {
  SIMPLE: "Receta simple",
  RETENIDA: "Receta retenida",
  CHEQUE: "Receta cheque",
};

/**
 * Generate a general medical prescription PDF linked to an existing patient.
 */
export async function generateMedicalPrescriptionPdf(
  input: MedicalPrescriptionPdfInput,
  logoUrls?: CertificateLogoUrls
): Promise<Uint8Array> {
  // Media carta (half-letter) vertical: 5.5" × 8.5" = 396 × 612 pt. Tamaño
  // estándar de recetario médico en Chile.
  const HALF_LETTER: [number, number] = [396, 612];
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage(HALF_LETTER);
  const { width, height } = page.getSize();
  const { font, bold } = await loadPdfFonts(pdfDoc);
  const doctor = createDoctorInfo(input);

  setPdfMetadata(pdfDoc, {
    title: "Receta médica",
    subject: "Receta médica",
    author: doctor.name,
    keywords: ["receta", "médica", input.patient.name],
  });

  const margin = 36;
  const contentWidth = width - 2 * margin;
  let y = height - margin;

  // Header compacto para páginas de continuación: folio + paciente, para que
  // ninguna hoja suelta quede sin identificación.
  const drawContinuationHeader = (pg: typeof page): number => {
    let hy = height - margin;
    const cont = "Receta médica (continuación)";
    pg.drawText(cont, { x: margin, y: hy, size: 11, font: bold, color: rgb(0.1, 0.4, 0.6) });
    if (input.folio) {
      const f = `Folio: ${input.folio}`;
      pg.drawText(f, {
        x: width - margin - font.widthOfTextAtSize(f, 8),
        y: hy,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    }
    hy -= 14;
    pg.drawText(`Paciente: ${input.patient.name} · ${input.patient.rut ?? "Sin RUT"}`, {
      x: margin,
      y: hy,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    return hy - 20;
  };
  const newPageIfNeeded = (minY: number) => {
    if (y >= minY) return;
    page = pdfDoc.addPage(HALF_LETTER);
    y = drawContinuationHeader(page);
  };

  const drawWrapped = (
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    size: number,
    textFont: PDFFont = font
  ) => {
    let nextY = startY;
    for (const line of wrapText(text, textFont, size, maxWidth)) {
      page.drawText(line, { x, y: nextY, size, font: textFont });
      nextY -= size + 4;
    }
    return nextY;
  };

  // Logos compactos para media carta.
  await drawHeaderLogos(pdfDoc, page, margin, width, y, logoUrls, 95, 64);
  y -= 40;

  const title = "Receta médica";
  page.drawText(title, {
    x: width / 2 - bold.widthOfTextAtSize(title, 14) / 2,
    y,
    size: 14,
    font: bold,
    color: rgb(0.1, 0.4, 0.6),
  });
  // Folio arriba a la derecha (correlativo + sufijo aleatorio).
  if (input.folio) {
    const folioText = `Folio: ${input.folio}`;
    page.drawText(folioText, {
      x: width - margin - font.widthOfTextAtSize(folioText, 8),
      y: y + 2,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  }
  y -= 22;

  // Bloque paciente compacto (2 líneas) — deja sitio para los medicamentos.
  const typeLabel = PRESCRIPTION_TYPE_LABEL[input.prescriptionType ?? "SIMPLE"];
  const line1 = `Paciente: ${input.patient.name}   ·   RUT: ${input.patient.rut ?? "Sin RUT"}`;
  const line2 = [`Fecha: ${formatDate(input.date)}`, typeLabel ? `Tipo: ${typeLabel}` : null]
    .filter(Boolean)
    .join("   ·   ");
  y = drawWrapped(line1, margin, y, contentWidth, 9);
  y -= 2;
  y = drawWrapped(line2, margin, y, contentWidth, 9);
  if (input.diagnosis?.trim()) {
    y -= 2;
    y = drawWrapped(`Diagnóstico: ${input.diagnosis.trim()}`, margin, y, contentWidth, 9);
  }

  y -= 10;
  page.drawText("Indicaciones farmacológicas", {
    x: margin,
    y,
    size: 10,
    font: bold,
    color: rgb(0.1, 0.4, 0.6),
  });
  y -= 14;

  for (const [index, medication] of input.medications.entries()) {
    newPageIfNeeded(165);
    y = drawWrapped(`${index + 1}. ${medication.name}`, margin, y, contentWidth, 10, bold);
    // Dosis · frecuencia · duración en UNA línea (compacto media carta).
    const posology = [medication.dosage, medication.frequency, medication.duration]
      .filter(Boolean)
      .join("  ·  ");
    if (posology) y = drawWrapped(posology, margin + 12, y, contentWidth - 12, 9);
    if (medication.instructions?.trim()) {
      y = drawWrapped(
        `Indicaciones: ${medication.instructions.trim()}`,
        margin + 12,
        y,
        contentWidth - 12,
        8.5
      );
    }
    y -= 7;
  }

  if (input.notes?.trim()) {
    newPageIfNeeded(165);
    y -= 4;
    page.drawText("Observaciones", {
      x: margin,
      y,
      size: 10,
      font: bold,
      color: rgb(0.1, 0.4, 0.6),
    });
    y -= 14;
    y = drawWrapped(input.notes.trim(), margin, y, contentWidth, 9);
  }

  // Footer en CADA página: doctor + firma + registro + "Página X de Y" + nota.
  // Así toda hoja (incl. continuaciones) es una receta válida y trazable por sí
  // sola — nunca queda una hoja suelta sin firma ni datos.
  const allPages = pdfDoc.getPages();
  const total = allPages.length;
  allPages.forEach((pg, index) => {
    drawDoctorFooter(pg, doctor, font, bold, margin, 135);
    if (input.doctorLicense?.trim()) {
      pg.drawText(`Reg. SIS N° ${input.doctorLicense.trim()}`, {
        x: width - margin - 180,
        y: 100,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    }
    pg.drawLine({
      start: { x: width - margin - 180, y: 135 },
      end: { x: width - margin, y: 135 },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    });
    pg.drawText("Firma y timbre", {
      x: width - margin - 125,
      y: 118,
      size: 9,
      font,
      color: rgb(0.1, 0.4, 0.6),
    });
    if (total > 1) {
      // y=46 (~16 mm) — sobre el margen inferior no imprimible de impresoras
      // Epson (puede llegar a ~14 mm en papel normal).
      const pageLabel = `Página ${index + 1} de ${total}`;
      pg.drawText(pageLabel, {
        x: width / 2 - font.widthOfTextAtSize(pageLabel, 8) / 2,
        y: 46,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
    drawFooterNote(pg, font, width);
  });

  return await pdfDoc.save();
}

/**
 * Sign PDF with .pfx certificate using @signpdf (actively maintained)
 * Supports multiple loading methods for Railway deployment:
 * 1. File path (Railway Volumes): PFX_PATH env var
 * 2. Base64 string (Railway Env Var): PFX_BASE64 env var
 *
 * @see https://github.com/vbuch/node-signpdf
 */
export async function signPdf(
  pdfBytes: Uint8Array,
  pfxPath?: string,
  pfxPassword?: string
): Promise<Uint8Array> {
  const actualPassword = pfxPassword || process.env.PFX_PASSWORD || "";

  let p12Buffer: Buffer | null = null;

  // Method 1: Load from Railway Volume or local file path
  if (process.env.PFX_PATH || pfxPath) {
    const actualPfxPath =
      pfxPath || process.env.PFX_PATH || path.join(SIGNATURES_DIR, "doctor.pfx");

    if (fs.existsSync(actualPfxPath)) {
      console.log(`Loading PFX from file: ${actualPfxPath}`);
      p12Buffer = fs.readFileSync(actualPfxPath);
    } else {
      console.warn(`PFX file not found at: ${actualPfxPath}`);
    }
  }

  // Method 2: Load from Base64 environment variable (Railway Env Var)
  if (!p12Buffer && process.env.PFX_BASE64) {
    console.log("Loading PFX from PFX_BASE64 env var");
    try {
      p12Buffer = Buffer.from(process.env.PFX_BASE64, "base64");
    } catch (error) {
      console.error("Failed to decode PFX_BASE64:", error);
    }
  }

  // No PFX available - return unsigned PDF
  if (!p12Buffer) {
    console.warn("No PFX certificate configured, returning unsigned PDF");
    console.warn("Set either PFX_PATH or PFX_BASE64 environment variable");
    return pdfBytes;
  }

  try {
    // Import @signpdf packages (actively maintained replacement for node-signpdf)
    const signpdfModule = await import("@signpdf/signpdf");
    const { P12Signer } = await import("@signpdf/signer-p12");

    // Dynamic-import default points to the SignPdf singleton, not the
    // namespace. TS resolves the .default as `typeof signpdf` (namespace)
    // under `module: NodeNext`, so cast to the instance type.
    const signpdf = signpdfModule.default as unknown as {
      sign(
        pdfBuffer: Buffer | Uint8Array | string,
        signer: unknown,
        signingTime?: Date
      ): Promise<Buffer>;
    };

    // Create P12 signer with certificate
    const signer = new P12Signer(p12Buffer, { passphrase: actualPassword });

    // Sign the PDF
    const signedPdf = await signpdf.sign(Buffer.from(pdfBytes), signer);

    console.log("PDF signed successfully with @signpdf");
    return new Uint8Array(signedPdf);
  } catch (error) {
    console.error("Error signing PDF with @signpdf:", error);
    // Return unsigned PDF if signing fails
    return pdfBytes;
  }
}

// --- Helper Functions ---

function formatDate(dateStr: string): string {
  return formatChileLongDate(dateStr);
}

function generateBodyText(input: MedicalCertificateInput): string[] {
  const paragraphs: string[] = [];

  // Main certification
  paragraphs.push(
    `Se certifica que ${input.patientName}, fue evaluada en atención médica el día ${formatDate(input.date)} por ${input.diagnosis}${input.symptoms ? `, presentando ${input.symptoms}` : ""}.`
  );

  // Status
  paragraphs.push(
    "El cuadro se encuentra en estudio por el equipo clínico, con indicación de seguimiento y medidas de control según evolución."
  );

  // Rest period
  if (input.restDays && input.restStartDate && input.restEndDate) {
    paragraphs.push(
      `Por lo anterior, se indica reposo médico por ${input.restDays} (${input.restDays === 1 ? "un" : input.restDays}) día${input.restDays === 1 ? "" : "s"}, correspondiente al ${formatDate(input.restStartDate)}${input.restDays > 1 ? ` hasta el ${formatDate(input.restEndDate)}` : ""}, con la finalidad de favorecer recuperación y observación clínica.`
    );
  }

  // Recommendations
  paragraphs.push(
    "Se le indica reposo y vigilancia de síntomas, evitar exposición a posibles desencadenantes hasta completar estudio, y control según indicación del equipo tratante o antes si presenta empeoramiento (dificultad respiratoria, edema progresivo, compromiso general u otros signos de alarma)."
  );

  // Purpose
  const purposeMap: Record<string, string> = {
    trabajo: "a solicitud del paciente para ser presentado en su lugar de trabajo",
    estudio: "a solicitud del paciente para ser presentado en su establecimiento educacional",
    otro: input.purposeDetail || "a solicitud del paciente",
  };
  paragraphs.push(`Se extiende el presente certificado ${purposeMap[input.purpose]}.`);

  return paragraphs;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
