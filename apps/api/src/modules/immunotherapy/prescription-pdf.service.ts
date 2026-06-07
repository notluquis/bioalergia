import fs from "node:fs";
import path from "node:path";
import type { QuoteResult } from "@finanzas/orpc-contracts/immunotherapy";
import { PDFDocument, rgb } from "pdf-lib";
import { formatChileLongDate } from "../../lib/time.ts";
import { loadPdfFonts, setPdfMetadata, wrapText } from "../pdf/pdf-base.ts";

const TEMPLATE_PATH = path.resolve(
  import.meta.dirname,
  "../../../assets/immunotherapy/rec-imk-tr-template.pdf"
);

type VaccineProduct = "ALXOID" | "CLUSTOID" | "CLUSTOID_B120" | "CLUSTOID_FORTE" | "ORAL_TEC";

export type PrescriptionPdfInput = {
  patient: {
    name: string;
    rut: string | null;
    birthDate: Date | null;
    phone: string | null;
    email: string | null;
  };
  clinic: {
    doctorName: string;
    doctorRut: string | null;
    email: string;
  };
  quote: QuoteResult;
  product: {
    name: string;
    vaccineProduct: VaccineProduct | null;
  };
  diagnosis?: string | null;
  observations?: string | null;
  date?: string;
};

type Point = { x: number; y: number };

const BLACK = rgb(0.05, 0.05, 0.05);
const CHECK = rgb(0, 0, 0);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function ageLabel(birthDate: Date | null, now = new Date()): string {
  if (!birthDate) return "";
  let years = now.getFullYear() - birthDate.getFullYear();
  const monthDelta = now.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) years -= 1;
  return years >= 0 ? String(years) : "";
}

function inferTemplateColumn(input: PrescriptionPdfInput): TemplateColumn {
  const productName = normalizeText(input.product.name);
  const hasBacterial = input.quote.allergens.some((a) =>
    /bacter|uromune|bactek|neumoniae|epidermidis|aureus|faecalis|vulgaris/.test(
      normalizeText(`${a.commonName} ${a.scientificName ?? ""}`)
    )
  );
  if (hasBacterial || productName.includes("bacter") || productName.includes("uromune")) {
    return "bacterial";
  }
  if (input.product.vaccineProduct === "ORAL_TEC" || /oral|subling|slim/.test(productName)) {
    return "slim";
  }
  if (input.product.vaccineProduct === "CLUSTOID_FORTE" || productName.includes("forte")) {
    return "clustekForte";
  }
  if (input.product.vaccineProduct === "CLUSTOID_B120" || /max|b120|b 120/.test(productName)) {
    return "clustekMax";
  }
  if (/alternaria/.test(productName)) return "alternaria";
  return "clustek";
}

type TemplateColumn =
  | "bacterial"
  | "slim"
  | "clustek"
  | "clustekMax"
  | "clustekForte"
  | "alternaria";

const COLUMN_X: Record<TemplateColumn, number> = {
  bacterial: 496,
  slim: 608,
  clustek: 708,
  clustekMax: 814,
  clustekForte: 922,
  alternaria: 1028,
};

const PRESENTATION_CHECKS: Record<TemplateColumn, { short: Point; long: Point }> = {
  clustek: { short: { x: 1146, y: 520 }, long: { x: 1146, y: 546 } },
  clustekMax: { short: { x: 1146, y: 613 }, long: { x: 1146, y: 640 } },
  clustekForte: { short: { x: 1146, y: 710 }, long: { x: 1146, y: 736 } },
  alternaria: { short: { x: 1146, y: 809 }, long: { x: 1146, y: 835 } },
  slim: { short: { x: 1146, y: 929 }, long: { x: 1146, y: 955 } },
  bacterial: { short: { x: 1146, y: 1059 }, long: { x: 1146, y: 1085 } },
};

const ALLERGEN_ROWS: { pattern: RegExp; y: number; forceColumn?: TemplateColumn }[] = [
  { pattern: /lolium|ballica|perenne/, y: 692 },
  { pattern: /cynodon|bermuda|dactylon/, y: 718 },
  { pattern: /dactylis|phleum|graminea|gramineas|pastos/, y: 866 },
  { pattern: /betula|abedul|verrucosa/, y: 974 },
  { pattern: /cupres|cipres/, y: 1000 },
  { pattern: /olea|olivo|europaea/, y: 1027 },
  { pattern: /platanus|platano/, y: 1054 },
  { pattern: /fraxinus|fresno/, y: 1080 },
  { pattern: /artemisia/, y: 1141 },
  { pattern: /chenopodium|cenizo/, y: 1168 },
  { pattern: /parietaria|judaica/, y: 1195 },
  { pattern: /plantago|llanten|lanceolata/, y: 1222 },
  { pattern: /pteronyssinus/, y: 1279 },
  { pattern: /farinae/, y: 1306 },
  { pattern: /blomia|tropicalis/, y: 1334 },
  { pattern: /lepidoglyphus|destructor/, y: 1361 },
  { pattern: /dermatophagoides|acaro|acaros/, y: 1390 },
  { pattern: /gato|felis|cat/, y: 1460 },
  { pattern: /perro|canis|dog/, y: 1488 },
  { pattern: /alternaria|alternata/, y: 1556, forceColumn: "alternaria" },
  { pattern: /bactek|pneumoniae|epidermidis|aureus|bacterias? gram/, y: 1845, forceColumn: "bacterial" },
  { pattern: /uromune|coli|klebsiella|faecalis|vulgaris/, y: 1895, forceColumn: "bacterial" },
];

export async function generatePrescriptionPdf(input: PrescriptionPdfInput): Promise<Uint8Array> {
  const template = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(template);
  const page = pdfDoc.getPages()[0];
  if (!page) throw new Error("La plantilla de receta no tiene página inicial");
  const { width, height } = page.getSize();
  const sx = width / 1516;
  const sy = height / 1959;
  const pt = (px: number, py: number): Point => ({ x: px * sx, y: height - py * sy });
  const { font, bold } = await loadPdfFonts(pdfDoc);
  const column = inferTemplateColumn(input);

  setPdfMetadata(pdfDoc, {
    title: "Prescripción de inmunoterapia",
    subject: "Receta de inmunoterapia",
    keywords: ["receta", "inmunoterapia", input.patient.name],
  });

  const drawText = (text: string | null | undefined, px: number, py: number, size = 8.5) => {
    const value = text?.trim();
    if (!value) return;
    const p = pt(px, py);
    page.drawText(value, { x: p.x, y: p.y, size, font, color: BLACK });
  };
  const drawWrapped = (
    text: string | null | undefined,
    px: number,
    py: number,
    maxWidthPx: number,
    size = 7.2
  ) => {
    const value = text?.trim();
    if (!value) return;
    let y = pt(px, py).y;
    for (const line of wrapText(value, font, size, maxWidthPx * sx).slice(0, 7)) {
      page.drawText(line, { x: px * sx, y, size, font, color: BLACK });
      y -= size + 2;
    }
  };
  const check = (point: Point) => {
    const p = pt(point.x, point.y);
    page.drawText("X", { x: p.x, y: p.y, size: 11, font: bold, color: CHECK });
  };

  drawText(input.patient.name, 135, 148, 8.5);
  drawText(ageLabel(input.patient.birthDate), 72, 187, 8.5);
  drawText(input.patient.rut, 380, 187, 8.5);
  drawText(input.patient.phone, 970, 187, 8.5);
  drawText(input.patient.email, 100, 226, 8);
  drawText(input.diagnosis, 125, 265, 8);

  const maintenanceQty = input.quote.lines.find((line) => line.isMaintenance)?.quantity ?? 0;
  const longPresentation = input.product.vaccineProduct === "ORAL_TEC" ? maintenanceQty >= 6 : maintenanceQty >= 10;
  check(longPresentation ? PRESENTATION_CHECKS[column].long : PRESENTATION_CHECKS[column].short);

  const unmatchedAllergens: string[] = [];
  for (const allergen of input.quote.allergens) {
    const text = normalizeText(`${allergen.commonName} ${allergen.scientificName ?? ""}`);
    const row = ALLERGEN_ROWS.find((r) => r.pattern.test(text));
    if (!row) {
      unmatchedAllergens.push(allergen.commonName);
      continue;
    }
    check({ x: COLUMN_X[row.forceColumn ?? column], y: row.y });
  }

  drawText(input.clinic.doctorName, 1168, 1175, 8);
  drawText(input.clinic.doctorRut, 1168, 1228, 8);
  drawText(input.clinic.email, 1168, 1282, 7.6);
  drawText(formatChileLongDate(input.date), 1168, 1336, 7.6);

  const allergenText =
    input.quote.allergens.length > 0
      ? `Alérgenos: ${input.quote.allergens.map((a) => a.commonName).join(", ")}.`
      : "";
  const observations = [input.observations?.trim(), unmatchedAllergens.length ? allergenText : null]
    .filter(Boolean)
    .join(" ");
  drawWrapped(observations, 1110, 1415, 360, 6.6);

  return await pdfDoc.save();
}
