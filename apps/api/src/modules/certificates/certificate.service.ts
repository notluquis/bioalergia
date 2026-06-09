import fs from "node:fs";
import path from "node:path";
import { PDFDocument, type PDFFont, degrees, rgb } from "pdf-lib";
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
): Promise<number> => {
  // Logo Bioalergia (izquierda) + AAAEIC (derecha): se alinean centrados
  // verticalmente en una MISMA banda (como el recetario físico), sin importar
  // que tengan distinta proporción. Devuelve el alto de la banda para que el
  // llamador avance el cursor sin solaparse con el contenido.
  const primary = await embedLogo(pdfDoc, logoUrls?.primary, "bioalergia.png");
  const secondary = await embedLogo(pdfDoc, logoUrls?.secondary, "aaaeic.png");

  const primaryHeight = primary ? (primary.height * primaryWidth) / primary.width : 0;
  const secondaryHeight = secondary ? (secondary.height * secondaryWidth) / secondary.width : 0;
  const band = Math.max(primaryHeight, secondaryHeight);

  if (primary) {
    drawImageTopLeft(page, primary, {
      x: margin,
      topY: y - (band - primaryHeight) / 2,
      targetWidth: primaryWidth,
    });
  }
  if (secondary) {
    drawImageTopLeft(page, secondary, {
      x: width - margin,
      topY: y - (band - secondaryHeight) / 2,
      targetWidth: secondaryWidth,
      alignRight: true,
    });
  }
  return band;
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
  const validez = "Válida solo con firma y timbre";
  page.drawText(validez, {
    x: width / 2 - font.widthOfTextAtSize(validez, 9) / 2,
    y: 66,
    size: 9,
    font,
    color: rgb(0.1, 0.4, 0.6),
  });
  const repro = "La reproducción gráfica es sólo con fines informativos.";
  page.drawText(repro, {
    x: width / 2 - font.widthOfTextAtSize(repro, 7) / 2,
    y: 56,
    size: 7,
    font,
    color: rgb(0.55, 0.55, 0.55),
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

// Modo de render:
//  - "full": todo (digital completa).
//  - "template": solo el chrome estático (logos, título, "Indicaciones",
//    footer/firma) — el RECETARIO EN BLANCO para imprimir en bulk.
//  - "overlay": solo la data variable (folio, paciente, medicamentos) en las
//    MISMAS coordenadas → calza encima del recetario pre-impreso.
export type PrescriptionPdfMode = "full" | "template" | "overlay";

export type MedicalPrescriptionPdfInput = MedicalPrescriptionInput & {
  patient: {
    name: string;
    rut: string | null;
  };
  // Derivados server-side (no input del médico).
  folio?: string;
  doctorLicense?: string;
  patientAge?: number;
  mode?: PrescriptionPdfMode;
  // ISSUED | ANNULLED — ANNULLED estampa marca de agua "ANULADA".
  status?: string;
  // QR + código público de verificación (/verificar/{code}). Si vienen, se
  // dibuja el QR + el código humano (inspirado en el recetario electrónico SNRE).
  qrCodeBuffer?: Buffer;
  verificationCode?: string;
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
  // Media carta (half-letter) vertical: 5.5"×8.5" = 396×612 pt. Tamaño estándar
  // de recetario en Chile. Se imprime centrado en hoja Letter/A4.
  const PAGE: [number, number] = [396, 612];
  // Banda inferior reservada para el footer (firma + médico + notas). El
  // contenido nunca baja de acá; si no cabe, salta de página.
  const FOOTER_TOP = 205;
  const showStatic = (input.mode ?? "full") !== "overlay";
  const showData = (input.mode ?? "full") !== "template";
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage(PAGE);
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
    if (showStatic) {
      const cont = "Receta médica (continuación)";
      pg.drawText(cont, { x: margin, y: hy, size: 11, font: bold, color: rgb(0.1, 0.4, 0.6) });
    }
    if (showData && input.folio) {
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
    if (showData) {
      pg.drawText(`Paciente: ${input.patient.name} · ${input.patient.rut ?? "Sin RUT"}`, {
        x: margin,
        y: hy,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
    return hy - 20;
  };
  const newPageIfNeeded = (minY: number) => {
    if (y >= minY) return;
    page = pdfDoc.addPage(PAGE);
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

  // Mide el alto que ocuparía un texto envuelto (sin dibujar).
  const measureWrapped = (text: string, size: number, maxWidth: number, textFont = font) =>
    wrapText(text, textFont, size, maxWidth).length * (size + 4);

  // ── Encabezado: logos alineados (Bioalergia izq / AAAeIC der), centrados en
  // una banda común — solo chrome (full/template). ──────────────────────────
  if (showStatic) {
    const band = await drawHeaderLogos(pdfDoc, page, margin, width, y, logoUrls, 140, 116);
    y -= band + 10;
  } else {
    y -= 50; // reservar la banda de logos para alinear el overlay
  }

  if (showStatic) {
    const title = "Receta médica";
    page.drawText(title, {
      x: width / 2 - bold.widthOfTextAtSize(title, 14) / 2,
      y,
      size: 14,
      font: bold,
      color: rgb(0.1, 0.4, 0.6),
    });
  }
  // Folio arriba a la derecha (data).
  if (showData && input.folio) {
    const folioText = `Folio: ${input.folio}`;
    page.drawText(folioText, {
      x: width - margin - font.widthOfTextAtSize(folioText, 8),
      y: y + 2,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  }
  y -= 20;

  // ── Bloque paciente: recuadro con datos (data). Inspirado en el recetario
  // electrónico SNRE (Nombre · RUN · Edad · Fecha). ─────────────────────────
  const typeLabel = PRESCRIPTION_TYPE_LABEL[input.prescriptionType ?? "SIMPLE"];
  const PATIENT_BOX_PAD = 8;
  if (showData) {
    const innerW = contentWidth - 2 * PATIENT_BOX_PAD;
    const ageText = input.patientAge != null ? `${input.patientAge} años` : "—";
    const infoText = `RUT: ${input.patient.rut ?? "Sin RUT"}   ·   Edad: ${ageText}   ·   Fecha: ${formatDate(input.date)}`;
    const infoLines = wrapText(infoText, font, 9, innerW);
    const dxLines = input.diagnosis?.trim()
      ? wrapText(`Diagnóstico: ${input.diagnosis.trim()}`, font, 9, innerW)
      : [];
    // header(14) + nombre(13) + infoLines + dxLines, todo dentro del pad.
    const boxHeight =
      14 + 13 + infoLines.length * 13 + dxLines.length * 13 + 2 * PATIENT_BOX_PAD;
    const boxTop = y + 4;
    page.drawRectangle({
      x: margin,
      y: boxTop - boxHeight,
      width: contentWidth,
      height: boxHeight,
      borderColor: rgb(0.78, 0.82, 0.88),
      borderWidth: 0.8,
      color: rgb(0.97, 0.98, 1),
    });
    const px = margin + PATIENT_BOX_PAD;
    let py = boxTop - PATIENT_BOX_PAD - 7;
    // header: "PACIENTE" izq + tipo de receta a la derecha.
    page.drawText("PACIENTE", { x: px, y: py, size: 6.5, font, color: rgb(0.5, 0.5, 0.5) });
    if (typeLabel) {
      const tw = font.widthOfTextAtSize(typeLabel.toUpperCase(), 6.5);
      page.drawText(typeLabel.toUpperCase(), {
        x: margin + contentWidth - PATIENT_BOX_PAD - tw,
        y: py,
        size: 6.5,
        font,
        color: rgb(0.1, 0.4, 0.6),
      });
    }
    py -= 13;
    page.drawText(input.patient.name, { x: px, y: py, size: 10, font: bold });
    py -= 13;
    for (const line of [...infoLines, ...dxLines]) {
      page.drawText(line, { x: px, y: py, size: 9, font });
      py -= 13;
    }
    y = boxTop - boxHeight - 14;
  } else {
    // template: reservar alto del bloque paciente (header + nombre + 2 líneas)
    // para que el overlay caiga en el mismo Y.
    y -= 14 + 13 + 2 * 13 + 2 * PATIENT_BOX_PAD + 14;
  }

  // ── "Rp." (prescripción) — etiqueta clásica de receta (chrome). ───────────
  if (showStatic) {
    page.drawText("Rp.", { x: margin, y, size: 13, font: bold, color: rgb(0.1, 0.4, 0.6) });
    page.drawText("(Prescripción)", {
      x: margin + 28,
      y: y + 1,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }
  y -= 18;

  // ── Tarjetas de medicamento (data): recuadro + barra de título + posología
  // etiquetada. Inspirado en la tarjeta del recetario electrónico SNRE. ──────
  if (showData) {
    for (const [index, medication] of input.medications.entries()) {
      const innerW = contentWidth - 2 * PATIENT_BOX_PAD;
      const posology = [medication.dosage, medication.frequency, medication.duration]
        .filter(Boolean)
        .join("   ·   ");
      const posH = posology ? measureWrapped(posology, 9, innerW) : 0;
      const instr = medication.instructions?.trim();
      const instrH = instr ? measureWrapped(`Indicaciones: ${instr}`, 8.5, innerW) : 0;
      const headerH = 20;
      const cardH = headerH + PATIENT_BOX_PAD + posH + instrH + PATIENT_BOX_PAD;

      newPageIfNeeded(cardH + FOOTER_TOP);
      const cardTop = y + 2;
      // borde
      page.drawRectangle({
        x: margin,
        y: cardTop - cardH,
        width: contentWidth,
        height: cardH,
        borderColor: rgb(0.78, 0.82, 0.88),
        borderWidth: 0.8,
      });
      // barra de título
      page.drawRectangle({
        x: margin,
        y: cardTop - headerH,
        width: contentWidth,
        height: headerH,
        color: rgb(0.92, 0.95, 0.99),
      });
      page.drawText(`${index + 1}. ${medication.name}`, {
        x: margin + PATIENT_BOX_PAD,
        y: cardTop - 14,
        size: 10,
        font: bold,
        color: rgb(0.1, 0.3, 0.5),
      });
      let cy = cardTop - headerH - PATIENT_BOX_PAD - 9 + 4;
      if (posology) cy = drawWrapped(posology, margin + PATIENT_BOX_PAD, cy, innerW, 9);
      if (instr) {
        cy = drawWrapped(
          `Indicaciones: ${instr}`,
          margin + PATIENT_BOX_PAD,
          cy,
          innerW,
          8.5,
          font
        );
      }
      y = cardTop - cardH - 8;
    }

    if (input.notes?.trim()) {
      newPageIfNeeded(FOOTER_TOP + 30);
      y -= 2;
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

    // ── QR + código de verificación + nota al farmacéutico (data). Se ubica en
    // el flujo, garantizando espacio sobre el footer (SNRE-style). ───────────
    if (input.qrCodeBuffer) {
      newPageIfNeeded(FOOTER_TOP + 90);
      const qrSize = 56;
      const qrImg = await pdfDoc.embedPng(input.qrCodeBuffer);
      const qrTop = y;
      page.drawImage(qrImg, { x: margin, y: qrTop - qrSize, width: qrSize, height: qrSize });
      const tx = margin + qrSize + 10;
      page.drawText("Verificar autenticidad", {
        x: tx,
        y: qrTop - 12,
        size: 8,
        font: bold,
        color: rgb(0.3, 0.3, 0.3),
      });
      if (input.verificationCode) {
        page.drawText(input.verificationCode, {
          x: tx,
          y: qrTop - 26,
          size: 11,
          font: bold,
          color: rgb(0.1, 0.4, 0.6),
        });
      }
      drawWrapped(
        "En caso de dudas, consulte a su Químico(a) Farmacéutico(a) o al prescriptor.",
        tx,
        qrTop - 40,
        contentWidth - qrSize - 10,
        7.5
      );
      y = qrTop - qrSize - 10;
    }
  }

  // Footer en CADA página: doctor + firma + registro + "Página X de Y" + nota.
  // El chrome (doctor/firma/registro/nota) solo en full/template; en overlay va
  // pre-impreso. "Página X de Y" en todas. Así ninguna hoja queda sin firma.
  const allPages = pdfDoc.getPages();
  const total = allPages.length;
  allPages.forEach((pg, index) => {
    if (showStatic) {
      // Zona de firma (arriba del bloque médico, mitad derecha) — no colisiona
      // con el texto del médico, que va abajo a la izquierda.
      const sigLineY = 184;
      pg.drawLine({
        start: { x: width - margin - 150, y: sigLineY },
        end: { x: width - margin, y: sigLineY },
        thickness: 0.5,
        color: rgb(0.4, 0.4, 0.4),
      });
      const firma = "Firma y timbre";
      pg.drawText(firma, {
        x: width - margin - 75 - font.widthOfTextAtSize(firma, 8.5) / 2,
        y: sigLineY - 12,
        size: 8.5,
        font,
        color: rgb(0.1, 0.4, 0.6),
      });
      if (input.doctorLicense?.trim()) {
        const reg = `Reg. SIS N° ${input.doctorLicense.trim()}`;
        pg.drawText(reg, {
          x: width - margin - 75 - font.widthOfTextAtSize(reg, 8) / 2,
          y: sigLineY - 24,
          size: 8,
          font,
          color: rgb(0.35, 0.35, 0.35),
        });
      }
      // Bloque médico compacto (izquierda, debajo de la firma).
      let dy = 150;
      pg.drawText(doctor.name, { x: margin, y: dy, size: 9.5, font: bold, color: rgb(0.1, 0.4, 0.6) });
      dy -= 12;
      for (const line of wrapText(doctor.specialty, font, 8, contentWidth)) {
        pg.drawText(line, { x: margin, y: dy, size: 8, font, color: rgb(0.1, 0.4, 0.6) });
        dy -= 11;
      }
      const contactLine = [`RUT: ${doctor.rut}`, doctor.email].filter(Boolean).join("  ·  ");
      pg.drawText(contactLine, { x: margin, y: dy, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
      dy -= 11;
      for (const line of wrapText(doctor.address, font, 8, contentWidth)) {
        pg.drawText(line, { x: margin, y: dy, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
        dy -= 11;
      }
      drawFooterNote(pg, font, width);
    }
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
    // Marca de agua diagonal "ANULADA" para recetas anuladas (re-descarga).
    if (input.status === "ANNULLED") {
      const label = "ANULADA";
      const size = 64;
      pg.drawText(label, {
        x: width / 2 - bold.widthOfTextAtSize(label, size) / 2 + 30,
        y: height / 2 - 90,
        size,
        font: bold,
        color: rgb(0.86, 0.15, 0.15),
        rotate: degrees(45),
        opacity: 0.18,
      });
    }
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
