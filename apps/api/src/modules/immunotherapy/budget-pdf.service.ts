import type { QuoteResult } from "@finanzas/orpc-contracts/immunotherapy";
import { type PDFFont, PDFDocument, rgb } from "pdf-lib";
import { formatChileLongDate } from "../../lib/time.ts";
import {
  drawImageTopLeft,
  embedLogo,
  formatCLP,
  loadPdfFonts,
  PDF_COLORS,
  setPdfMetadata,
  wrapText,
} from "../pdf/pdf-base.ts";

const ACCENT = PDF_COLORS.accent;
const GRAY = PDF_COLORS.gray;
const LINE = PDF_COLORS.line;
const clp = formatCLP;

export type BudgetPdfClinic = {
  name: string;
  legalName: string | null;
  legalRut: string | null;
  address: string;
  phoneWhatsapp: string;
  phoneLandline: string;
  email: string;
  doctorName: string;
  doctorRut: string | null;
  logoUrl?: string | null;
};

export type BudgetPdfInput = {
  clinic: BudgetPdfClinic;
  patient: { name: string; rut: string | null };
  quote: QuoteResult;
  lab: string | null;
  terms?: string | null;
  intro?: string | null;
  date?: string;
};

export async function generateBudgetPdf(input: BudgetPdfInput): Promise<Uint8Array> {
  const { clinic, patient, quote } = input;
  const hidden = (k: QuoteResult["hiddenSections"][number]) => quote.hiddenSections.includes(k);
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const { font, bold } = await loadPdfFonts(pdfDoc);
  setPdfMetadata(pdfDoc, {
    title: "Presupuesto de inmunoterapia",
    subject: "Presupuesto",
    keywords: ["presupuesto", "inmunoterapia", patient.name],
  });
  const margin = 50;
  let y = height - margin;

  const newPageIfNeeded = (minY: number) => {
    if (y < minY) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }
  };
  const drawParagraphs = (text: string, size: number) => {
    for (const paragraph of text.split(/\n\s*\n/)) {
      for (const line of paragraph.split("\n")) {
        for (const wline of wrapText(line.trim(), font, size, width - 2 * margin)) {
          newPageIfNeeded(60);
          page.drawText(wline, { x: margin, y, size, font, color: GRAY });
          y -= size + 2.5;
        }
      }
      y -= 5;
    }
  };

  const logoImg = await embedLogo(pdfDoc, clinic.logoUrl, "bioalergia.png");
  if (logoImg) drawImageTopLeft(page, logoImg, { x: margin, topY: y, targetWidth: 165 });
  y -= 70;

  // Prestador institucional
  if (clinic.legalName) {
    page.drawText(clinic.legalName, { x: margin, y, size: 10, font: bold, color: GRAY });
    y -= 12;
  }
  if (clinic.legalRut) {
    page.drawText(`RUT: ${clinic.legalRut}`, { x: margin, y, size: 9, font, color: GRAY });
    y -= 12;
  }
  y -= 8;

  // Título
  const title = "Presupuesto de inmunoterapia (anual)";
  page.drawText(title, {
    x: width / 2 - bold.widthOfTextAtSize(title, 14) / 2,
    y,
    size: 14,
    font: bold,
    color: ACCENT,
  });
  y -= 24;

  // Introducción (plantilla editable, interpolada). Sección ocultable.
  if (!hidden("intro") && input.intro?.trim()) {
    drawParagraphs(input.intro.trim(), 8.5);
    y -= 6;
  }

  // Datos paciente + fecha
  const date = formatChileLongDate(input.date);
  const concentrationLine =
    !hidden("concentration") && quote.concentrationUtMl != null
      ? `Concentración: ${quote.concentrationUtMl.toLocaleString("es-CL")} UT/mL${
          quote.perAllergen ? " por alérgeno" : ""
        }`
      : null;
  const showLab = !hidden("lab") && input.lab;
  const patientLines = [
    `Paciente: ${patient.name}`,
    ...(hidden("patientRut") ? [] : [`RUT: ${patient.rut ?? "—"}`]),
    `Fecha: ${date}`,
    `Producto: ${quote.productName}${showLab ? ` — ${input.lab}` : ""}`,
    ...(concentrationLine ? [concentrationLine] : []),
    ...(hidden("maintenanceMl") ? [] : [`Volumen de mantención: ${quote.maintenanceMl} mL`]),
  ];
  for (const line of patientLines) {
    page.drawText(line, { x: margin, y, size: 10, font });
    y -= 15;
  }
  y -= 6;

  // Alérgenos incluidos (omitidos si hidden)
  if (!hidden("allergens") && quote.allergens.length > 0) {
    page.drawText("Alérgenos incluidos:", { x: margin, y, size: 10, font: bold, color: ACCENT });
    y -= 14;
    for (const a of quote.allergens) {
      const name = a.scientificName ? `${a.commonName} (${a.scientificName})` : a.commonName;
      page.drawText(`• ${name}`, { x: margin + 10, y, size: 9, font });
      y -= 12;
    }
    y -= 6;
  }

  // Tabla de costos (desglose). Se puede ocultar entera ("breakdown") o solo
  // las columnas de precios ("prices").
  const colConcept = margin;
  const colQty = width - margin - 230;
  const colUnit = width - margin - 150;
  const colSub = width - margin - 60;
  const showPrices = !hidden("prices");

  const drawRow = (concept: string, qty: string, unit: string, sub: string, f: PDFFont) => {
    page.drawText(concept, { x: colConcept, y, size: 9, font: f });
    page.drawText(qty, { x: colQty, y, size: 9, font: f });
    if (showPrices) {
      page.drawText(unit, { x: colUnit, y, size: 9, font: f });
      page.drawText(sub, { x: colSub, y, size: 9, font: f });
    }
  };

  if (!hidden("breakdown")) {
    page.drawRectangle({
      x: margin - 4,
      y: y - 4,
      width: width - 2 * margin + 8,
      height: 18,
      color: rgb(0.93, 0.93, 0.93),
    });
    drawRow("Concepto", "Cant.", "Unitario", "Subtotal", bold);
    y -= 20;

    for (const line of quote.lines) {
      drawRow(line.label, String(line.quantity), clp(line.unitPrice), clp(line.subtotal), font);
      y -= 6;
      page.drawLine({
        start: { x: margin - 4, y },
        end: { x: width - margin + 4, y },
        thickness: 0.5,
        color: LINE,
      });
      y -= 12;
    }
    y -= 6;
  }

  // Totales (el total siempre se muestra). Subtotal/descuento sólo si hay precios.
  const totalsX = colUnit;
  const drawTotal = (label: string, value: string, f: PDFFont) => {
    page.drawText(label, { x: totalsX, y, size: 10, font: f });
    page.drawText(value, { x: colSub, y, size: 10, font: f });
    y -= 16;
  };
  if (showPrices) {
    drawTotal("Subtotal", clp(quote.subtotal), font);
    if (quote.discountPct > 0 && !hidden("discount")) {
      drawTotal(`Descuento ${quote.discountPct}%`, `- ${clp(quote.discountAmount)}`, font);
    }
  }
  drawTotal("Total anual", clp(quote.total), bold);

  // Condiciones económicas / disclosures (editables desde settings)
  const termsText = input.terms?.trim();
  if (!hidden("terms") && termsText) {
    y -= 12;
    newPageIfNeeded(170);
    page.drawText("Información importante y condiciones", {
      x: margin,
      y,
      size: 9,
      font: bold,
      color: ACCENT,
    });
    y -= 13;
    drawParagraphs(termsText, 7.5);
  }

  // Firmas (al pie de la página actual)
  if (!hidden("signatures")) {
    newPageIfNeeded(150);
    y = 130;
    const sigWidth = 180;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + sigWidth, y },
      thickness: 0.5,
      color: GRAY,
    });
    page.drawLine({
      start: { x: width - margin - sigWidth, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: GRAY,
    });
    y -= 12;
    page.drawText("Paciente", { x: margin, y, size: 9, font });
    page.drawText(clinic.doctorName, { x: width - margin - sigWidth, y, size: 9, font });
    y -= 11;
    page.drawText(patient.name, { x: margin, y, size: 8, font: bold, color: GRAY });
    if (clinic.doctorRut) {
      page.drawText(`RUT: ${clinic.doctorRut}`, {
        x: width - margin - sigWidth,
        y,
        size: 8,
        font,
        color: GRAY,
      });
    }
  }

  return await pdfDoc.save();
}
