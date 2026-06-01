import fs from "node:fs";
import path from "node:path";
import type { QuoteDto } from "@finanzas/orpc-contracts/quotes";
import dayjs from "dayjs";
import "dayjs/locale/es.js";
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";

dayjs.locale("es");

const ASSETS_DIR = path.resolve(import.meta.dirname, "../../../assets");
const LOGOS_DIR = path.join(ASSETS_DIR, "logos");

const ACCENT = rgb(0.1, 0.4, 0.6);
const DARK = rgb(0.15, 0.15, 0.15);
const GRAY = rgb(0.4, 0.4, 0.4);
const LINE = rgb(0.8, 0.8, 0.8);
const HEADER_BG = rgb(0.93, 0.93, 0.93);

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
function clp(value: number): string {
  return clpFormatter.format(value);
}

export type QuotePdfClinic = {
  name: string;
  legalName: string | null;
  legalRut: string | null;
  address: string;
  phoneWhatsapp: string;
  phoneLandline: string;
  email: string;
};

export type QuotePdfInput = {
  clinic: QuotePdfClinic;
  quote: QuoteDto;
};

async function drawLogo(pdfDoc: PDFDocument, page: PDFPage, x: number, y: number): Promise<number> {
  try {
    const logoPath = path.join(LOGOS_DIR, "bioalergia.png");
    if (!fs.existsSync(logoPath)) return 0;
    const img = await pdfDoc.embedPng(fs.readFileSync(logoPath));
    const dims = img.scale(0.45);
    page.drawImage(img, { x, y: y - dims.height, width: dims.width, height: dims.height });
    return dims.height;
  } catch (error) {
    console.warn("No se pudo cargar el logo:", error);
    return 0;
  }
}

export async function generateQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  const { clinic, quote } = input;
  const company = quote.company;
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 45;
  let y = height - margin;

  const text = (s: string, x: number, yy: number, size: number, f = font, color = DARK) =>
    page.drawText(s, { x, y: yy, size, font: f, color });

  const newPageIfNeeded = (minY: number) => {
    if (y < minY) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }
  };

  // ── Encabezado: logo + datos emisor (izquierda) / caja documento (derecha) ──
  const logoH = await drawLogo(pdfDoc, page, margin, y);
  let issuerY = y - Math.max(logoH, 36) - 6;
  if (clinic.legalName || clinic.name) {
    text(clinic.legalName ?? clinic.name, margin, issuerY, 10, bold);
    issuerY -= 12;
  }
  if (clinic.legalRut) {
    text(`RUT: ${clinic.legalRut}`, margin, issuerY, 8.5, font, GRAY);
    issuerY -= 11;
  }
  text(clinic.address, margin, issuerY, 8, font, GRAY);
  issuerY -= 11;
  text(`Tel: ${clinic.phoneLandline} · ${clinic.phoneWhatsapp}`, margin, issuerY, 8, font, GRAY);
  issuerY -= 11;
  text(clinic.email, margin, issuerY, 8, font, GRAY);

  // Caja documento (derecha)
  const boxW = 180;
  const boxX = width - margin - boxW;
  const boxTop = y;
  const boxH = 70;
  page.drawRectangle({
    x: boxX,
    y: boxTop - boxH,
    width: boxW,
    height: boxH,
    borderColor: ACCENT,
    borderWidth: 1.2,
    color: rgb(1, 1, 1),
  });
  const centerText = (s: string, yy: number, size: number, f: PDFFont, color = ACCENT) =>
    page.drawText(s, {
      x: boxX + boxW / 2 - f.widthOfTextAtSize(s, size) / 2,
      y: yy,
      size,
      font: f,
      color,
    });
  centerText(clinic.legalRut ? `R.U.T: ${clinic.legalRut}` : clinic.name, boxTop - 18, 10, bold);
  centerText("Cotización", boxTop - 38, 13, bold);
  centerText(`Folio N° ${quote.folio}`, boxTop - 58, 11, bold);

  y = Math.min(issuerY, boxTop - boxH) - 22;

  // ── Datos del cliente (dos columnas) ───────────────────────────────
  const solicitante = quote.contact?.name ?? null;
  const fields: { label: string; value: string | null }[] = [
    { label: "Señor(es)", value: company.razonSocial },
    { label: "R.U.T", value: company.rut },
    { label: "Giro", value: company.giro },
    { label: "Dirección", value: company.direccion },
    { label: "Comuna", value: company.comuna },
    { label: "Ciudad", value: company.ciudad },
    { label: "Contacto / Solicitante", value: solicitante },
    { label: "Email", value: company.email },
    { label: "Condición de pago", value: quote.condicionPago ?? company.condicionPago },
    { label: "Fecha", value: dayjs(quote.issueDate).format("D [de] MMMM [de] YYYY") },
    {
      label: "Vencimiento",
      value: quote.dueDate ? dayjs(quote.dueDate).format("D [de] MMMM [de] YYYY") : null,
    },
    { label: "Vendedor", value: quote.createdByName },
  ];
  const present = fields.filter((f) => f.value);
  const colW = (width - 2 * margin) / 2;
  const startY = y;
  present.forEach((fld, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fx = margin + col * colW;
    const fy = startY - row * 26;
    text(fld.label, fx, fy, 7, font, GRAY);
    text(fld.value ?? "—", fx, fy - 11, 9, font, DARK);
  });
  y = startY - Math.ceil(present.length / 2) * 26 - 10;

  // ── Tabla de líneas ────────────────────────────────────────────────
  const colNum = margin;
  const colCode = margin + 22;
  const colDetail = margin + 80;
  const colQty = width - margin - 150;
  const colUnit = width - margin - 95;
  const colTotal = width - margin - 5;

  const drawHeader = () => {
    page.drawRectangle({
      x: margin - 4,
      y: y - 4,
      width: width - 2 * margin + 8,
      height: 17,
      color: HEADER_BG,
    });
    text("#", colNum, y, 8, bold);
    text("Código", colCode, y, 8, bold);
    text("Detalle", colDetail, y, 8, bold);
    text("Cant", colQty, y, 8, bold);
    text("P. Unit", colUnit, y, 8, bold);
    page.drawText("Total", {
      x: colTotal - bold.widthOfTextAtSize("Total", 8),
      y,
      size: 8,
      font: bold,
    });
    y -= 20;
  };

  drawHeader();
  quote.items.forEach((it, idx) => {
    newPageIfNeeded(140);
    if (y === height - margin) drawHeader();
    const detail = [it.brand, it.category].filter(Boolean).join(" · ");
    text(String(idx + 1), colNum, y, 8.5, font);
    text(it.code ?? "—", colCode, y, 8.5, font);
    text(it.description, colDetail, y, 8.5, font);
    const qtyStr = `${it.quantity % 1 === 0 ? it.quantity : it.quantity.toFixed(2)}${
      it.format ? ` ${it.format}` : ""
    }`;
    text(qtyStr, colQty, y, 8.5, font);
    text(clp(it.unitPrice), colUnit, y, 8.5, font);
    page.drawText(clp(it.subtotal), {
      x: colTotal - font.widthOfTextAtSize(clp(it.subtotal), 8.5),
      y,
      size: 8.5,
      font,
    });
    if (detail) {
      y -= 10;
      text(detail, colDetail, y, 7, font, GRAY);
    }
    y -= 6;
    page.drawLine({
      start: { x: margin - 4, y },
      end: { x: width - margin + 4, y },
      thickness: 0.4,
      color: LINE,
    });
    y -= 13;
  });

  y -= 6;
  newPageIfNeeded(150);

  // ── Comentarios (izquierda) + Totales (derecha) ────────────────────
  const totalsBlockY = y;
  if (quote.comments?.trim()) {
    text("Comentarios", margin, y, 8, bold, ACCENT);
    let cy = y - 13;
    for (const line of wrapText(quote.comments.trim(), font, 8, colW - 10)) {
      text(line, margin, cy, 8, font, GRAY);
      cy -= 11;
    }
  }

  // Totales
  const tLabelX = width - margin - 150;
  const tValX = colTotal;
  let ty = totalsBlockY;
  const totalRow = (label: string, value: string, f = font, color = DARK) => {
    text(label, tLabelX, ty, 9, f, color);
    page.drawText(value, {
      x: tValX - f.widthOfTextAtSize(value, 9),
      y: ty,
      size: 9,
      font: f,
      color,
    });
    ty -= 15;
  };
  totalRow("Subtotal", clp(quote.subtotal));
  if (quote.discount > 0) totalRow("Descuento", `- ${clp(quote.discount)}`);
  totalRow(
    `IVA ${quote.taxRate % 1 === 0 ? quote.taxRate : quote.taxRate.toFixed(1)}%`,
    clp(quote.taxAmount)
  );
  page.drawLine({
    start: { x: tLabelX, y: ty + 5 },
    end: { x: tValX, y: ty + 5 },
    thickness: 0.6,
    color: ACCENT,
  });
  totalRow("TOTAL", clp(quote.total), bold, ACCENT);

  return await pdfDoc.save();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        out.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    out.push(current);
  }
  return out;
}
