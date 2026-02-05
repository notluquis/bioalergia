import fs from "node:fs";
import path from "node:path";
import dayjs from "dayjs";
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";
import "dayjs/locale/es.js";
import QRCode from "qrcode";

import type { MedicalCertificateInput } from "./certificate.schema.js";
import { defaultDoctorInfo } from "./certificate.schema.js";

dayjs.locale("es");

// Paths to assets
const ASSETS_DIR = path.resolve(import.meta.dirname, "../../../assets");
const LOGOS_DIR = path.join(ASSETS_DIR, "logos");
const SIGNATURES_DIR = path.join(ASSETS_DIR, "signatures");

const createDoctorInfo = (input: MedicalCertificateInput) => ({
  name: input.doctorName || defaultDoctorInfo.name,
  specialty: input.doctorSpecialty || defaultDoctorInfo.specialty,
  title: defaultDoctorInfo.title,
  rut: input.doctorRut || defaultDoctorInfo.rut,
  email: input.doctorEmail || defaultDoctorInfo.email,
  address: input.doctorAddress || defaultDoctorInfo.address,
});

const drawLogoIfExists = async (
  pdfDoc: PDFDocument,
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  logoPath: string,
  options: { alignRight?: boolean; scale: number; x: number; y: number },
  label: string,
) => {
  try {
    if (!fs.existsSync(logoPath)) return;
    const logoBytes = fs.readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImage.scale(options.scale);
    page.drawImage(logoImage, {
      x: options.alignRight ? options.x - logoDims.width : options.x,
      y: options.y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    });
  } catch (error) {
    console.warn(`Could not load ${label} logo:`, error);
  }
};

const drawHeaderLogos = async (
  pdfDoc: PDFDocument,
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  margin: number,
  width: number,
  y: number,
) => {
  await drawLogoIfExists(
    pdfDoc,
    page,
    path.join(LOGOS_DIR, "bioalergia.png"),
    {
      scale: 0.5,
      x: margin,
      y,
    },
    "bioalergia",
  );

  await drawLogoIfExists(
    pdfDoc,
    page,
    path.join(LOGOS_DIR, "aaaeic.png"),
    {
      alignRight: true,
      scale: 0.3,
      x: width - margin,
      y,
    },
    "aaaeic",
  );
};

const drawPatientInfo = (
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  font: PDFFont,
  margin: number,
  startY: number,
  input: MedicalCertificateInput,
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
  paragraphs: string[],
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
  date: string,
) => {
  const watermarkText = `Válido ${dayjs(date).format("DD/MM/YYYY")}`;
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
  startY: number,
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
  width: number,
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
  width: number,
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
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  // --- HEADER: Logos ---
  await drawHeaderLogos(pdfDoc, page, margin, width, y);

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
  pfxPassword?: string,
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

    const signpdf = signpdfModule.default;

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
  return dayjs(dateStr).format("D [de] MMMM [de] YYYY");
}

function generateBodyText(input: MedicalCertificateInput): string[] {
  const paragraphs: string[] = [];

  // Main certification
  paragraphs.push(
    `Se certifica que ${input.patientName}, fue evaluada en atención médica el día ${formatDate(input.date)} por ${input.diagnosis}${input.symptoms ? `, presentando ${input.symptoms}` : ""}.`,
  );

  // Status
  paragraphs.push(
    "El cuadro se encuentra en estudio por el equipo clínico, con indicación de seguimiento y medidas de control según evolución.",
  );

  // Rest period
  if (input.restDays && input.restStartDate && input.restEndDate) {
    paragraphs.push(
      `Por lo anterior, se indica reposo médico por ${input.restDays} (${input.restDays === 1 ? "un" : input.restDays}) día${input.restDays === 1 ? "" : "s"}, correspondiente al ${formatDate(input.restStartDate)}${input.restDays > 1 ? ` hasta el ${formatDate(input.restEndDate)}` : ""}, con la finalidad de favorecer recuperación y observación clínica.`,
    );
  }

  // Recommendations
  paragraphs.push(
    "Se le indica reposo y vigilancia de síntomas, evitar exposición a posibles desencadenantes hasta completar estudio, y control según indicación del equipo tratante o antes si presenta empeoramiento (dificultad respiratoria, edema progresivo, compromiso general u otros signos de alarma).",
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
