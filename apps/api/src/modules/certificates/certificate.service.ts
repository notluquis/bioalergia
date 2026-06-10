import fs from "node:fs";
import path from "node:path";
import { PDFDocument, type PDFFont, degrees, rgb } from "pdf-lib";
import QRCode from "qrcode";

import { formatChileLongDate, formatChileShortDate } from "../../lib/time.ts";
import { drawImageTopLeft, embedLogo, loadPdfFonts, setPdfMetadata } from "../pdf/pdf-base.ts";
import type { MedicalCertificateInput, MedicalPrescriptionInput } from "./certificate.schema.ts";
import { defaultDoctorInfo } from "./certificate.schema.ts";

// Tokens de marca Bioalergia (packages/theme/bioalergia.css → RGB para pdf-lib).
const BRAND_BLUE = rgb(0.102, 0.302, 0.478); // #1a4d7a
const BRAND_AMBER = rgb(0.831, 0.643, 0.208); // #d4a435
const BRAND_INK = rgb(0.09, 0.13, 0.17); // #17222b
const BRAND_GRAY = rgb(0.42, 0.45, 0.5);
const BRAND_BORDER = rgb(0.8, 0.84, 0.89);
const BRAND_TINT = rgb(0.95, 0.97, 0.99); // fondo azul muy suave

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
  // Alinear por la BASE (no por el centro): el texto de ambos logos tiene su
  // línea base cerca del borde inferior; los íconos (molécula / caballito de mar)
  // sobresalen ARRIBA con distinto alto. Alineando los bordes inferiores, las
  // letras "Bioalergia" y "AAAeIC" quedan a la misma altura.
  const bottomY = y - band;

  if (primary) {
    drawImageTopLeft(page, primary, {
      x: margin,
      topY: bottomY + primaryHeight,
      targetWidth: primaryWidth,
    });
  }
  if (secondary) {
    drawImageTopLeft(page, secondary, {
      x: width - margin,
      topY: bottomY + secondaryHeight,
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
    color: BRAND_BLUE,
  });
  y -= 14;
  page.drawText(doctor.specialty, { x: margin, y, size: 9, font, color: BRAND_BLUE });
  y -= 12;
  page.drawText(doctor.title, { x: margin, y, size: 9, font, color: BRAND_BLUE });
  y -= 12;
  page.drawText(`RUT: ${doctor.rut}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: BRAND_BLUE,
  });
  y -= 12;
  page.drawText(doctor.email, { x: margin, y, size: 9, font, color: BRAND_BLUE });
  y -= 12;
  page.drawText(doctor.address, { x: margin, y, size: 9, font, color: BRAND_BLUE });
};

const drawFooterNote = (
  page: Awaited<ReturnType<PDFDocument["addPage"]>>,
  font: PDFFont,
  width: number
) => {
  // Una sola nota legal centrada al pie. La autenticidad ya la indica el QR
  // ("Verificar autenticidad") → no se repite acá.
  const validez = "Válida solo con firma y timbre";
  page.drawText(validez, {
    x: width / 2 - font.widthOfTextAtSize(validez, 8.5) / 2,
    y: 50,
    size: 8.5,
    font,
    color: BRAND_BLUE,
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
export async function generateQRCode(code: string): Promise<Buffer> {
  // La verificación pública vive en el sitio público (bioalergia.cl/verificar),
  // no en la intranet. Override con VERIFY_BASE_URL si cambia.
  const base = (process.env.VERIFY_BASE_URL || "https://bioalergia.cl").replace(/\/+$/, "");
  const verifyUrl = `${base}/verificar/${code}`;
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
    color: BRAND_BLUE,
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
  // Fecha de nacimiento (YYYY-MM-DD) + sexo — requisito Código Sanitario Art. 101.
  patientBirthDate?: string;
  patientSex?: string;
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
  const { font, bold, italic } = await loadPdfFonts(pdfDoc);
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
      pg.drawText(cont, { x: margin, y: hy, size: 11, font: bold, color: BRAND_BLUE });
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

  // Trunca un texto a un ancho con elipsis (mantiene el alto fijo del recuadro).
  const truncateToWidth = (text: string, textFont: typeof font, size: number, maxW: number) => {
    if (textFont.widthOfTextAtSize(text, size) <= maxW) return text;
    let t = text;
    while (t.length > 1 && textFont.widthOfTextAtSize(`${t}…`, size) > maxW) t = t.slice(0, -1);
    return `${t}…`;
  };

  // ALTURAS FIJAS del encabezado: el chrome estático (template) y los datos
  // (overlay) deben caer en el MISMO Y para que el overlay se imprima exacto
  // sobre el recetario pre-impreso. Nada acá puede depender del contenido.
  const LOGO_BAND_H = 46;
  const PATIENT_BOX_PAD = 10;
  const PATIENT_BOX_H = 15 + 13 + 13 + 2 * PATIENT_BOX_PAD; // nombre + datos + emisión
  // Diagnóstico (opcional, largo variable): área full-width de hasta 2 líneas
  // DEBAJO del recuadro. Reserva FIJA (también en template) para que el overlay
  // caiga alineado. Antes iba dentro del recuadro y se truncaba a 1 línea.
  const DX_MAX_LINES = 2;
  const DX_AREA_H = DX_MAX_LINES * 12 + 6;
  const typeLabel = PRESCRIPTION_TYPE_LABEL[input.prescriptionType ?? "SIMPLE"];

  // ── Logos (estático), banda de alto FIJO en ambos modos. ──────────────────
  if (showStatic) {
    await drawHeaderLogos(pdfDoc, page, margin, width, y, logoUrls, 140, 116);
  }
  y -= LOGO_BAND_H + 12;

  // ── Título (estático, sin regla). ─────────────────────────────────────────
  if (showStatic) {
    const title = "Receta médica";
    page.drawText(title, {
      x: width / 2 - bold.widthOfTextAtSize(title, 13) / 2,
      y,
      size: 13,
      font: bold,
      color: BRAND_BLUE,
    });
  }
  y -= 22;

  // ── Bloque paciente: el RECUADRO + label "PACIENTE" son ESTÁTICOS (van
  // pre-impresos en el recetario). Los VALORES (nombre, RUT, edad, fecha,
  // diagnóstico, tipo) son DATA (overlay). Alto FIJO para que alineen. ───────
  const boxTop = y + 4;
  const px = margin + PATIENT_BOX_PAD;
  // Etiqueta gris + valor (negrita opcional) inline; devuelve x final.
  const drawField = (label: string, value: string, x: number, yy: number, valueBold = false) => {
    page.drawText(label, { x, y: yy, size: 8.5, font, color: BRAND_GRAY });
    const lw = font.widthOfTextAtSize(`${label} `, 8.5);
    const vFont = valueBold ? bold : font;
    const vSize = valueBold ? 9.5 : 9;
    page.drawText(value, { x: x + lw, y: yy, size: vSize, font: vFont, color: BRAND_INK });
    return x + lw + vFont.widthOfTextAtSize(value, vSize);
  };
  if (showStatic) {
    page.drawRectangle({
      x: margin,
      y: boxTop - PATIENT_BOX_H,
      width: contentWidth,
      height: PATIENT_BOX_H,
      borderColor: BRAND_BORDER,
      borderWidth: 0.8,
      color: BRAND_TINT,
    });
  }
  if (showData) {
    const innerW = contentWidth - 2 * PATIENT_BOX_PAD;
    let py = boxTop - PATIENT_BOX_PAD - 8;
    // Fila 1: Paciente: NOMBRE (negrita) + tipo de receta a la derecha (ámbar).
    // El nombre se trunca para no invadir el tag de tipo (overflow-safe).
    const typeW = typeLabel ? bold.widthOfTextAtSize(typeLabel.toUpperCase(), 6.5) : 0;
    const nameMaxW =
      innerW - font.widthOfTextAtSize("Paciente: ", 8.5) - typeW - (typeLabel ? 16 : 0);
    drawField("Paciente:", truncateToWidth(input.patient.name, bold, 9.5, nameMaxW), px, py, true);
    if (typeLabel) {
      const tw = bold.widthOfTextAtSize(typeLabel.toUpperCase(), 6.5);
      page.drawText(typeLabel.toUpperCase(), {
        x: margin + contentWidth - PATIENT_BOX_PAD - tw,
        y: py + 1,
        size: 6.5,
        font: bold,
        color: BRAND_AMBER,
      });
    }
    py -= 15;
    // Fila 2: RUT · Fecha de nacimiento · Edad (requisito Código Sanitario).
    const ageText = input.patientAge != null ? `${input.patientAge} años` : "—";
    const birthText = input.patientBirthDate
      ? `${input.patientBirthDate.slice(8, 10)}/${input.patientBirthDate.slice(5, 7)}/${input.patientBirthDate.slice(0, 4)}`
      : "—";
    let fx = drawField("RUT:", input.patient.rut ?? "Sin RUT", px, py, true);
    fx = drawField("Sexo:", input.patientSex?.trim() || "—", fx + 14, py);
    fx = drawField("Nac:", birthText, fx + 14, py);
    drawField("Edad:", ageText, fx + 14, py);
    py -= 13;
    // Fila 3: fecha de emisión (separada).
    drawField("Fecha de emisión:", formatDate(input.date), px, py);
  }
  y = boxTop - PATIENT_BOX_H - 10;

  // ── Diagnóstico (data): full-width, hasta 2 líneas. Reserva fija siempre. ──
  if (showData && input.diagnosis?.trim()) {
    const all = wrapText(`Diagnóstico: ${input.diagnosis.trim()}`, font, 9, contentWidth);
    const lines = all.slice(0, DX_MAX_LINES);
    // Si se truncó, marcá la última con elipsis.
    if (all.length > DX_MAX_LINES && lines.length > 0) {
      lines[lines.length - 1] = truncateToWidth(`${lines[lines.length - 1]} …`, font, 9, contentWidth);
    }
    let dyy = y;
    for (const line of lines) {
      page.drawText(line, { x: margin, y: dyy, size: 9, font, color: BRAND_INK });
      dyy -= 12;
    }
  }
  y -= DX_AREA_H;

  // ── "Rp." en itálica — etiqueta clásica de receta (chrome estático). ───────
  if (showStatic) {
    page.drawText("Rp.", { x: margin, y, size: 11, font: italic ?? bold, color: BRAND_BLUE });
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
      // El nombre del medicamento puede ser largo → se envuelve dentro de la
      // barra de título (overflow-safe), que crece según las líneas.
      const titleLines = wrapText(`${index + 1}. ${medication.name}`, bold, 10, innerW - 2);
      const headerH = Math.max(20, titleLines.length * 12 + 8);
      const cardH = headerH + PATIENT_BOX_PAD + posH + instrH + PATIENT_BOX_PAD;

      newPageIfNeeded(cardH + FOOTER_TOP);
      const cardTop = y + 2;
      // borde
      page.drawRectangle({
        x: margin,
        y: cardTop - cardH,
        width: contentWidth,
        height: cardH,
        borderColor: BRAND_BORDER,
        borderWidth: 0.8,
      });
      // barra de título + filete ámbar a la izquierda (acento de marca).
      page.drawRectangle({
        x: margin,
        y: cardTop - headerH,
        width: contentWidth,
        height: headerH,
        color: BRAND_TINT,
      });
      page.drawRectangle({
        x: margin,
        y: cardTop - headerH,
        width: 3,
        height: headerH,
        color: BRAND_AMBER,
      });
      let ty = cardTop - 13;
      for (const line of titleLines) {
        page.drawText(line, {
          x: margin + PATIENT_BOX_PAD + 2,
          y: ty,
          size: 10,
          font: bold,
          color: BRAND_BLUE,
        });
        ty -= 12;
      }
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
      y = cardTop - cardH - 12;
    }

    if (input.notes?.trim()) {
      newPageIfNeeded(FOOTER_TOP + 30);
      y -= 2;
      page.drawText("Observaciones", {
        x: margin,
        y,
        size: 10,
        font: bold,
        color: BRAND_BLUE,
      });
      y -= 14;
      y = drawWrapped(input.notes.trim(), margin, y, contentWidth, 9);
    }

    // El QR + folio + código van a la esquina inferior izquierda (footer), no
    // en el flujo — ver el forEach de páginas más abajo.
  }

  // QR embebido una vez (el forEach es síncrono, no puede await).
  const qrImage =
    showData && input.qrCodeBuffer ? await pdfDoc.embedPng(input.qrCodeBuffer) : null;

  // Footer en CADA página: doctor + firma + registro + "Página X de Y" + nota.
  // El chrome (doctor/firma/registro/nota) solo en full/template; en overlay va
  // pre-impreso. "Página X de Y" en todas. Así ninguna hoja queda sin firma.
  const allPages = pdfDoc.getPages();
  const total = allPages.length;
  allPages.forEach((pg, index) => {
    const lastPage = index === total - 1;
    // Footer 2 columnas ANCLADO AL FONDO: IZQUIERDA médico, DERECHA firma+QR,
    // ambas alineadas por su BASE (grid). Nota legal única centrada al pie.
    const leftColW = 156;
    const FOOTER_BASE = 62; // base inferior común de ambas columnas
    const specLines = wrapText(doctor.specialty, font, 8, leftColW);
    const addrLines = wrapText(doctor.address, font, 8, leftColW);
    // Top del bloque médico para que su última línea caiga en FOOTER_BASE.
    const docTopY = FOOTER_BASE + 12 + specLines.length * 10 + 10 + 10 + addrLines.length * 10 - 10;
    if (showStatic) {
      // Zona de firma ARRIBA del bloque médico (mitad derecha).
      const sigLineY = docTopY + 26;
      pg.drawLine({
        start: { x: width - margin - 150, y: sigLineY },
        end: { x: width - margin, y: sigLineY },
        thickness: 0.5,
        color: rgb(0.4, 0.4, 0.4),
      });
      const firma = "Firma y timbre";
      pg.drawText(firma, {
        x: width - margin - 75 - font.widthOfTextAtSize(firma, 8.5) / 2,
        y: sigLineY - 11,
        size: 8.5,
        font,
        color: BRAND_BLUE,
      });
      // Columna IZQUIERDA: bloque médico (top-down, termina en FOOTER_BASE).
      let dy = docTopY;
      pg.drawText(doctor.name, { x: margin, y: dy, size: 9.5, font: bold, color: BRAND_BLUE });
      dy -= 12;
      for (const line of specLines) {
        pg.drawText(line, { x: margin, y: dy, size: 8, font, color: BRAND_BLUE });
        dy -= 10;
      }
      const regLine = [
        `RUT: ${doctor.rut}`,
        input.doctorLicense?.trim() ? `Reg. SIS N° ${input.doctorLicense.trim()}` : null,
      ]
        .filter(Boolean)
        .join("   ·   ");
      pg.drawText(regLine, { x: margin, y: dy, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
      dy -= 10;
      pg.drawText(doctor.email, { x: margin, y: dy, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
      dy -= 10;
      for (const line of addrLines) {
        pg.drawText(line, { x: margin, y: dy, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
        dy -= 10;
      }
      drawFooterNote(pg, font, width);
    }
    // Columna DERECHA (data): QR alineado por su BASE con el bloque médico.
    if (showData && lastPage) {
      const qrSize = 52;
      const qx = width - margin - qrSize;
      const qrBottom = FOOTER_BASE - 2;
      const qrTop = qrBottom + qrSize;
      if (qrImage) {
        pg.drawImage(qrImage, { x: qx, y: qrBottom, width: qrSize, height: qrSize });
      }
      // Texto a la IZQUIERDA del QR, centrado verticalmente sobre el QR.
      const rightEdge = qx - 8;
      const drawRight = (text: string, ty: number, size: number, f = font, color = BRAND_GRAY) => {
        pg.drawText(text, {
          x: rightEdge - f.widthOfTextAtSize(text, size),
          y: ty,
          size,
          font: f,
          color,
        });
      };
      drawRight("Verificar autenticidad", qrTop - 10, 7.5);
      if (input.verificationCode) drawRight(input.verificationCode, qrTop - 26, 11, bold, BRAND_BLUE);
      if (input.folio) drawRight(`Folio: ${input.folio}`, qrTop - 42, 7.5);
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
