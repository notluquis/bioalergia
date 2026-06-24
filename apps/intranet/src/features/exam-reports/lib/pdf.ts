import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExamType, SkinReaction } from "@finanzas/orpc-contracts/exam-reports";

import { EXAM_TYPE_CONFIG, composeReactionLines } from "./exam-types";

/**
 * Generate the PDF informe in the exact layout of the source templates.
 *
 * Letter portrait (612 x 792 pt). Pure-coordinate jspdf — no HTML2PDF,
 * no headless browser, no extra infra.
 *
 * Golden-2026 + Chilean norm + EAACI compliance:
 *   - Logos preserve natural aspect ratio (3.75:1 bioalergia,
 *     2.85:1 AAAEIC) so they never look squashed.
 *   - Disclaimer / body text uses ASCII-safe punctuation
 *     (helvetica standard PDF font doesn't ship the `≥` / `–` / `₂`
 *     glyphs cleanly — substitute kerning made lines look stretched).
 *   - Procedure metadata block (date, site, lots, reading time,
 *     measurement method) — defaults to "—" when caller doesn't pass
 *     the optional fields.
 *   - Validity statement reads histamine + saline control mm values.
 *   - Results table via jspdf-autotable with histamine + saline rows
 *     always present so reader can validate the run.
 *   - EAACI 2023 nomenclature disclaimer verbatim.
 *   - Cross-reactivity note when allergen tags hit PR-10 / profilin /
 *     tropomyosin / LTP.
 *   - Signature block with prestador Superintendencia de Salud N°.
 *   - Footer Ley 21.719 small-print block.
 *   - Lucide-style section icons (5 inline SVG paths, no new dep).
 */

// ── Types (extended for golden-2026; new fields optional, default null) ──

interface AllergenLite {
  id: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  pollenType: string | null;
  /** Free-form tag list. Used to auto-detect PR-10 / profilin / LTP. */
  tags?: string[] | null;
}

interface PdfReaction {
  reaction: SkinReaction;
  allergen: AllergenLite;
  /** Pápula in mm (used in the results table). */
  papuleMm?: number | null;
  /** Eritema in mm (optional — clinic may not measure). */
  erythemaMm?: number | null;
}

interface PdfSection {
  sectionKey: string;
  label: string;
  reactions: PdfReaction[];
}

/**
 * Procedure metadata required by EAACI 2023 + Chilean Norma técnica.
 * All fields optional — render `—` when missing.
 *
 * NOTE: `sitio anatómico` + lote/fabricante de extractos + lote
 * histamina + lote control negativo were intentionally dropped in
 * Phase 2 — operator feedback was that these never matched the
 * physical run and added noise. The wizard now relies on the XLSX
 * skin-test snapshot for control mm values; lots stay out of the PDF.
 */
interface PdfProcedureMeta {
  /** ISO date string YYYY-MM-DD or display string. */
  testDate?: string | null;
  /** HH:mm. */
  testTime?: string | null;
  /** Reading time in minutes (e.g. 15). */
  readingTimeMin?: number | null;
  /** Measurement method (default "Diámetro mayor (EAACI 2023)"). */
  measurementMethod?: string | null;
}

/** Test controls (validity gates). */
interface PdfControls {
  /** Histamine wheal in mm. Valid when ≥ 3. */
  histamineMm?: number | null;
  /** Saline (negative) wheal in mm. Valid when < 3. */
  salineMm?: number | null;
}

interface PdfReportInput {
  examType: ExamType;
  conclusionText: string;
  reagents: string | null;
  technique: string | null;
  notes: string | null;
  doctorName: string;
  doctorSpecialty: string;
  doctorRut: string | null;
  patient: {
    fullName: string;
    age: string | null;
    rut: string | null;
  };
  sections: PdfSection[];
  /** Optional — defaults rendered as `—`. */
  procedure?: PdfProcedureMeta | null;
  /** Optional — validity statement skipped when both fields missing. */
  controls?: PdfControls | null;
}

interface ClinicSettingsLite {
  name: string;
  address: string;
  phoneWhatsapp: string;
  phoneLandline: string;
  email: string;
  website: string;
  websiteSecondary: string;
  signatureUrl: string | null;
  /** Chilean clinic legal name for Ley 21.719 footer. */
  legalName?: string | null;
  /** Chilean clinic RUT (data controller). */
  rut?: string | null;
  /** Superintendencia de Salud prestador number. */
  superintendenciaNumber?: string | null;
  /** Privacy contact email (defaults to settings.email). */
  privacyContactEmail?: string | null;
  /** Privacy policy URL (rendered as text). */
  privacyPolicyUrl?: string | null;
}

// ── Brand palette (do not change — matches templates) ────────────────────
const NAVY: [number, number, number] = [12, 38, 84];
const SECTION_BLUE: [number, number, number] = [42, 95, 184];
const PEACH: [number, number, number] = [253, 217, 178];
const TEXT: [number, number, number] = [0, 0, 0];
const FOOTER: [number, number, number] = [80, 80, 80];
const TABLE_ACCENT: [number, number, number] = [255, 240, 230];

const PAGE_W = 612;
const PAGE_H = 792;
const SIDEBAR_W = 32;
const MARGIN_X = 60;
const CONTENT_RIGHT = PAGE_W - 50;
const CONTENT_W = CONTENT_RIGHT - MARGIN_X;
/** Pad applied to splitTextToSize maxW so helvetica width-rounding
 *  errors don't push a line over the limit (which jspdf then tries
 *  to fit, producing the squashed/spread-out artifact). */
const SPLIT_PAD = 6;

// ── Logo natural aspect ratios ───────────────────────────────────────────
// Bioalergia SVG natural 5000x1333 → 3.7509
// AAAEIC PNG  natural 601x211       → 2.8483
const BIOALERGIA_ASPECT = 5000 / 1333;
const AAAEIC_ASPECT = 601 / 211;
const LOGO_H = 48;
const BIOALERGIA_W = LOGO_H * BIOALERGIA_ASPECT; // ≈ 180.0
const AAAEIC_W = LOGO_H * AAAEIC_ASPECT; // ≈ 136.7

// ── Inline lucide SVG paths (lucide-static is not installed; copying 5
//    paths avoids a new dep). All from lucide-react@1.16.0 source. ──────
const LUCIDE_PATHS: Record<string, string> = {
  activity:
    "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",
  shieldCheck:
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z m-11 4 3 3 5-5",
  fileText:
    "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z M14 2v4a2 2 0 0 0 2 2h4 M10 9H8 M16 13H8 M16 17H8",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  stethoscope:
    "M11 2v2 M5 2v2 M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1 M8 15a6 6 0 0 0 12 0v-3 M11 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
};

/** Rasterize one of our 5 inline lucide icons to a PNG data URL. */
async function renderLucideIcon(
  name: keyof typeof LUCIDE_PATHS,
  sizePx: number
): Promise<string | null> {
  const pathData = LUCIDE_PATHS[name];
  if (!pathData) return null;
  // Each "path" entry is a single d= string. Split combined entries
  // (some icons have multiple subpaths joined by spaces above).
  // We just emit one <path d="..."> per segment separated by single
  // spaces inside one SVG — fine because lucide subpaths are valid
  // SVG path data when concatenated. To stay safe we emit them as
  // multiple paths split on " M " (each subpath starts with M/m).
  const subpaths = pathData.split(/\s(?=[Mm]\s)/).map((s) => s.trim());
  const pathEls = subpaths.map((d) => `<path d="${d}" />`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sizePx}" height="${sizePx}" fill="none" stroke="rgb(${SECTION_BLUE.join(",")})" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathEls}</svg>`;
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return rasterizeSvg(dataUrl, sizePx * 3, sizePx * 3);
}

/** Async helper: load an asset as a data URL so jspdf.addImage can embed it. */
async function loadAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("[exam-reports/pdf] loadAsDataUrl failed", url, err);
    return null;
  }
}

function inferImageFormat(dataUrl: string): "PNG" | "JPEG" | "SVG" {
  if (dataUrl.startsWith("data:image/svg")) return "SVG";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  return "PNG";
}

/**
 * Rasterize an SVG data URL to a PNG data URL. Width/height = on-canvas
 * pixel dims — keep ~3x placement size for crisp print resolution.
 */
async function rasterizeSvg(
  svgDataUrl: string,
  widthPx: number,
  heightPx: number
): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined" || typeof document === "undefined") {
      // Non-browser env (some test runners) — skip raster step.
      resolve(null);
      return;
    }
    // Safety timeout: jsdom never fires onload/onerror for some data URIs,
    // which would leave the whole PDF generation hanging. Resolve null
    // after 1.5s so the caller gracefully skips the image.
    const timer = setTimeout(() => {
      console.warn("[exam-reports/pdf] SVG raster timed out");
      resolve(null);
    }, 1500);
    const done = (value: string | null): void => {
      clearTimeout(timer);
      resolve(value);
    };
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext("2d");
      if (!ctx) return done(null);
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      try {
        done(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("[exam-reports/pdf] canvas.toDataURL failed", err);
        done(null);
      }
    };
    img.onerror = (err) => {
      console.warn("[exam-reports/pdf] SVG image load failed", err);
      done(null);
    };
    img.src = svgDataUrl;
  });
}

/** Resolve a logo (URL or raw data URL) to an embeddable PNG/JPEG. */
async function loadLogoAsRaster(
  url: string,
  pxW: number,
  pxH: number
): Promise<{ data: string; fmt: "PNG" | "JPEG" } | null> {
  const data = await loadAsDataUrl(url);
  if (!data) return null;
  const fmt = inferImageFormat(data);
  if (fmt === "SVG") {
    const raster = await rasterizeSvg(data, pxW, pxH);
    return raster ? { data: raster, fmt: "PNG" } : null;
  }
  return { data, fmt };
}

// ── Text-safety helpers (golden-2026) ────────────────────────────────────

/**
 * Replace Unicode glyphs that helvetica (standard PDF Type1 font)
 * cannot render. jspdf substitutes missing glyphs with awkward
 * widths which produces the "spread-out" body text artifact.
 */
export function sanitizePdfText(input: string): string {
  return (
    input
      .replace(/≥/g, ">=")
      .replace(/≤/g, "<=")
      .replace(/–/g, "-")
      .replace(/—/g, "-")
      .replace(/₀/g, "0")
      .replace(/₁/g, "1")
      .replace(/₂/g, "2")
      .replace(/₃/g, "3")
      .replace(/₄/g, "4")
      .replace(/₅/g, "5")
      .replace(/₆/g, "6")
      .replace(/₇/g, "7")
      .replace(/₈/g, "8")
      .replace(/₉/g, "9")
      .replace(/°/g, "º")
      // Right single quote → ASCII apostrophe
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
  );
}

/**
 * Wrap + strip trailing whitespace per line. Tightens maxW by
 * SPLIT_PAD to avoid the jspdf width-rounding cliff that triggers
 * inter-character spreading.
 */
function safeSplit(doc: jsPDF, text: string, maxW: number): string[] {
  const clean = sanitizePdfText(text);
  const lines = doc.splitTextToSize(clean, Math.max(20, maxW - SPLIT_PAD));
  return lines.map((l: string) => l.replace(/\s+$/g, ""));
}

// ── Cross-reactivity detection (4-tier, EAACI 2024) ───────────────────
//
// 15 tag families now backfilled in `clinical_allergens.tags` (see
// migrations 20260518120000 + 20260518130000). Each maps to one of four
// disclaimer tiers driven by clinical severity, not by family taxonomy:
//
//   severe       — anaphylaxis risk markers. Trigger a bold warning note.
//                  Storage proteins (2S albumin / 7S vicilin / 11S
//                  legumin) drive systemic IgE reactions; GRP (Pru p 7
//                  homologs) marks cypress-fruit severe phenotype;
//                  alpha-gal is delayed but can be anaphylactic.
//
//   standard     — classic OAS / cross-pollen-food panel. Reactions
//                  usually local oral, occasionally systemic. PR-10 /
//                  profilin / LTP / tropomyosin.
//
//   delayed      — alpha-gal-specific timing note (3-6 h post-ingestion).
//
//   informational — low-prevalence panallergens with VARIABLE cross-
//                   reactivity (polcalcin, defensin) and the latex-fruit
//                   chitinase syndrome. Surfaced as appendix-style note,
//                   not as a clinical warning.
//
// One tag can belong to multiple tiers (e.g. alpha-gal is BOTH severe
// and delayed) so the renderer emits a separate paragraph per active
// tier rather than a single mutually-exclusive label.

const TIER_TAG_MATCHERS = {
  severe: [
    /^grp$/i,
    /^alpha[-_ ]?gal$/i,
    /^2s[-_ ]?albumin$/i,
    /^7s[-_ ]?vicilin$/i,
    /^11s[-_ ]?legumin$/i,
  ],
  standard: [/^pr[-_ ]?10$/i, /^profilin$/i, /^tropomyosin$/i, /^ltp$/i],
  delayed: [/^alpha[-_ ]?gal$/i],
  informational: [/^polcalcin$/i, /^defensin$/i, /^chitinase$/i],
} as const;

export interface CrossReactivityTiers {
  readonly severe: boolean;
  readonly standard: boolean;
  readonly delayed: boolean;
  readonly informational: boolean;
}

export function detectCrossReactivityTiers(sections: PdfSection[]): CrossReactivityTiers {
  const tiers = { severe: false, standard: false, delayed: false, informational: false };
  for (const s of sections) {
    for (const r of s.reactions) {
      const tags = r.allergen.tags ?? [];
      for (const t of tags) {
        if (!tiers.severe && TIER_TAG_MATCHERS.severe.some((p) => p.test(t))) {
          tiers.severe = true;
        }
        if (!tiers.standard && TIER_TAG_MATCHERS.standard.some((p) => p.test(t))) {
          tiers.standard = true;
        }
        if (!tiers.delayed && TIER_TAG_MATCHERS.delayed.some((p) => p.test(t))) {
          tiers.delayed = true;
        }
        if (!tiers.informational && TIER_TAG_MATCHERS.informational.some((p) => p.test(t))) {
          tiers.informational = true;
        }
        if (tiers.severe && tiers.standard && tiers.delayed && tiers.informational) {
          return tiers;
        }
      }
    }
  }
  return tiers;
}

function hasCrossReactiveAllergens(sections: PdfSection[]): boolean {
  const t = detectCrossReactivityTiers(sections);
  return t.severe || t.standard || t.delayed || t.informational;
}

// ── Interpretation thresholds (EAACI 2023) ──────────────────────────────

export function interpretPapule(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm)) return "—";
  if (mm < 3) return "Negativo";
  if (mm <= 5) return "Sensibilizacion leve";
  if (mm <= 8) return "Sensibilizacion moderada";
  return "Sensibilizacion intensa";
}

// ── EAACI 2023 nomenclature disclaimer (verbatim, ASCII-safe) ──────────
const EAACI_2023_NOMENCLATURE =
  "Una prueba cutanea positiva indica sensibilizacion IgE, no diagnostica alergia clinica. " +
  "El diagnostico de alergia requiere correlacion con la historia clinica del paciente.";

// ── Page-shell helpers ──────────────────────────────────────────────────

function drawSidebar(doc: jsPDF, clinicName: string): void {
  doc.setFillColor(...PEACH);
  doc.rect(0, 0, SIDEBAR_W, PAGE_H, "F");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(sanitizePdfText(clinicName.toUpperCase()), SIDEBAR_W / 2 + 7, PAGE_H - 80, {
    angle: 90,
    align: "left",
  });
}

interface SectionTitleOptions {
  doc: jsPDF;
  y: number;
  title: string;
  iconDataUrl: string | null;
}

function drawSectionTitle({ doc, y, title, iconDataUrl }: SectionTitleOptions): number {
  const iconSize = 14;
  let textX = MARGIN_X;
  if (iconDataUrl) {
    try {
      doc.addImage(iconDataUrl, "PNG", MARGIN_X, y - iconSize + 2, iconSize, iconSize);
      textX = MARGIN_X + iconSize + 6;
    } catch (err) {
      console.warn("[exam-reports/pdf] addImage(icon) failed", err);
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SECTION_BLUE);
  doc.text(sanitizePdfText(title), textX, y);
  return y + 16;
}

// ── Main entry ──────────────────────────────────────────────────────────

export async function generateExamReportPdf(
  report: PdfReportInput,
  settings: ClinicSettingsLite,
  options?: { logoUrl?: string }
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const config = EXAM_TYPE_CONFIG[report.examType];
  const isPatch = report.examType === "PATCH";

  drawSidebar(doc, settings.name);

  // ── Logos (preserve natural aspect ratio) ────────────────────────────
  const bioalergiaUrl = options?.logoUrl ?? "/logo_bioalergia_eslogan.svg";
  const aaaeicUrl = "/aaaeic.png";

  // Pre-raster dims must match natural aspect — pick 3x placement.
  const [bioalergiaLogo, aaaeicLogo] = await Promise.all([
    loadLogoAsRaster(bioalergiaUrl, Math.round(BIOALERGIA_W * 3), Math.round(LOGO_H * 3)),
    loadLogoAsRaster(aaaeicUrl, Math.round(AAAEIC_W * 3), Math.round(LOGO_H * 3)),
  ]);

  if (bioalergiaLogo) {
    try {
      doc.addImage(bioalergiaLogo.data, bioalergiaLogo.fmt, MARGIN_X, 30, BIOALERGIA_W, LOGO_H);
    } catch (err) {
      console.warn("[exam-reports/pdf] bioalergia logo addImage failed", err);
    }
  }
  if (aaaeicLogo) {
    try {
      doc.addImage(aaaeicLogo.data, aaaeicLogo.fmt, CONTENT_RIGHT - AAAEIC_W, 30, AAAEIC_W, LOGO_H);
    } catch (err) {
      console.warn("[exam-reports/pdf] aaaeic logo addImage failed", err);
    }
  }

  // ── Title (multi-line, centered) ─────────────────────────────────────
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  let y = 110;
  const titleLines = config.title.split("\n");
  for (const line of titleLines) {
    doc.text(sanitizePdfText(line), PAGE_W / 2, y, { align: "center" });
    y += 18;
  }

  // ── Pre-render section icons in parallel ─────────────────────────────
  const [iconUser, iconFile, iconShield, iconActivity, iconStetho] = await Promise.all([
    renderLucideIcon("user", 14),
    renderLucideIcon("fileText", 14),
    renderLucideIcon("shieldCheck", 14),
    renderLucideIcon("activity", 14),
    renderLucideIcon("stethoscope", 14),
  ]);

  // ── Patient block ────────────────────────────────────────────────────
  y += 14;
  y = drawSectionTitle({ doc, y, title: "PACIENTE", iconDataUrl: iconUser });
  doc.setFontSize(12);
  const drawLabel = (label: string, value: string | null, yPos: number): void => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    const safeLabel = sanitizePdfText(label);
    doc.text(safeLabel, MARGIN_X, yPos);
    const labelW = doc.getTextWidth(safeLabel);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT);
    doc.text(sanitizePdfText(value ?? "—"), MARGIN_X + labelW + 4, yPos);
  };
  drawLabel("NOMBRE: ", report.patient.fullName, y);
  y += 14;
  drawLabel("EDAD: ", report.patient.age, y);
  y += 14;
  drawLabel("RUT:  ", report.patient.rut, y);
  y += 20;

  // ── Procedure metadata block (FileText icon) ─────────────────────────
  if (!isPatch) {
    y = drawSectionTitle({ doc, y, title: "DATOS DEL PROCEDIMIENTO", iconDataUrl: iconFile });
    const meta = report.procedure ?? {};
    // Phase 2: sitio + lote fields dropped — operator feedback was that
    // these never matched the physical run and added clutter.
    const metaRows: [string, string][] = [
      ["Fecha", meta.testDate ?? "—"],
      ["Hora del test", meta.testTime ?? "—"],
      [
        "Tiempo de lectura",
        meta.readingTimeMin != null ? `${meta.readingTimeMin} minutos` : "15-20 minutos",
      ],
      ["Metodo de medicion", meta.measurementMethod ?? "Diametro mayor (EAACI 2023)"],
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT);
    for (const [k, v] of metaRows) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      const labelTxt = sanitizePdfText(`${k}: `);
      doc.text(labelTxt, MARGIN_X, y);
      const lw = doc.getTextWidth(labelTxt);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT);
      doc.text(sanitizePdfText(v), MARGIN_X + lw, y);
      y += 12;
    }
    y += 6;
  }

  // ── Validity statement (ShieldCheck icon) ───────────────────────────
  const controls = report.controls;
  if (!isPatch && controls && (controls.histamineMm != null || controls.salineMm != null)) {
    y = drawSectionTitle({ doc, y, title: "CONTROLES DEL EXAMEN", iconDataUrl: iconShield });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);

    const histTxt =
      controls.histamineMm != null
        ? `Control positivo (histamina) = ${controls.histamineMm} mm (valido si >= 3 mm).`
        : "Control positivo (histamina) = - mm.";
    const salTxt =
      controls.salineMm != null
        ? `Control negativo (suero salino) = ${controls.salineMm} mm (valido si < 3 mm).`
        : "Control negativo (suero salino) = - mm.";

    for (const line of [histTxt, salTxt]) {
      const wrapped = safeSplit(doc, line, CONTENT_W);
      for (const wl of wrapped) {
        doc.text(wl, MARGIN_X, y);
        y += 12;
      }
    }
    y += 6;
  }

  // ── Conclusion ───────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(11);
  doc.text("CONCLUSION EXAMEN: ", MARGIN_X, y);
  const concW = doc.getTextWidth("CONCLUSION EXAMEN: ");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT);
  const concWrapped = safeSplit(doc, report.conclusionText, CONTENT_W - concW);
  if (concWrapped.length > 0) {
    doc.text(concWrapped[0] ?? "", MARGIN_X + concW, y);
    for (let i = 1; i < concWrapped.length; i++) {
      y += 12;
      const line = concWrapped[i];
      if (line) doc.text(line, MARGIN_X, y);
    }
  }
  y += 22;

  // ── Results table (Activity icon) ────────────────────────────────────
  if (!isPatch) {
    y = drawSectionTitle({ doc, y, title: "RESULTADOS", iconDataUrl: iconActivity });

    interface Row {
      allergen: string;
      papule: string;
      erythema: string;
      interp: string;
      positive: boolean;
    }

    const rows: Row[] = [];

    // Always include the controls as the first two rows so the reader
    // can validate the run at a glance. Phase 2: user-facing labels
    // changed from "Histamina" / "Suero salino" to "Control positivo
    // (mm)" / "Control negativo (mm)" — internal field names
    // (histamineMm / salineMm) stay for code clarity.
    rows.push({
      allergen: "Control positivo (histamina)",
      papule: controls?.histamineMm != null ? `${controls.histamineMm}` : "—",
      erythema: "—",
      interp:
        controls?.histamineMm != null
          ? controls.histamineMm >= 3
            ? "Valido"
            : "INVALIDO (< 3 mm)"
          : "—",
      positive: false,
    });
    rows.push({
      allergen: "Control negativo (suero salino)",
      papule: controls?.salineMm != null ? `${controls.salineMm}` : "—",
      erythema: "—",
      interp:
        controls?.salineMm != null
          ? controls.salineMm < 3
            ? "Valido"
            : "INVALIDO (>= 3 mm)"
          : "—",
      positive: false,
    });

    for (const s of report.sections) {
      for (const r of s.reactions) {
        const mm = r.papuleMm ?? null;
        const interp = interpretPapule(mm);
        rows.push({
          allergen: sanitizePdfText(r.allergen.commonName),
          papule: mm != null ? `${mm}` : "—",
          erythema: r.erythemaMm != null ? `${r.erythemaMm}` : "—",
          interp,
          positive: r.reaction !== "NEGATIVA",
        });
      }
    }

    autoTable(doc, {
      startY: y,
      head: [["Alergeno", "Papula (mm)", "Eritema (mm)", "Interpretacion"]],
      body: rows.map((r) => [r.allergen, r.papule, r.erythema, r.interp]),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 3,
        textColor: TEXT,
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: NAVY,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 60, halign: "center" },
        2: { cellWidth: 60, halign: "center" },
        3: { cellWidth: 130 },
      },
      margin: { left: MARGIN_X, right: PAGE_W - CONTENT_RIGHT },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const row = rows[data.row.index];
          if (row?.positive) {
            data.cell.styles.fillColor = TABLE_ACCENT;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    // Read final Y from autoTable internal state.
    interface AutoTableHooked {
      lastAutoTable?: { finalY?: number };
    }
    const finalY = (doc as unknown as AutoTableHooked).lastAutoTable?.finalY;
    y = (typeof finalY === "number" ? finalY : y) + 16;
  }

  // ── PATCH path keeps the original section/grouping body ─────────────
  if (isPatch) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SECTION_BLUE);
    doc.text("ALERGENOS TESTEADOS:", MARGIN_X, y);
    y += 18;

    const groupedConfig = config.sections.reduce<Map<string | null, typeof config.sections>>(
      (acc, s) => {
        const k = s.group ?? null;
        const bucket = acc.get(k) ?? [];
        bucket.push(s);
        acc.set(k, bucket);
        return acc;
      },
      new Map()
    );

    const reactionsBySectionKey = new Map(report.sections.map((s) => [s.sectionKey, s]));
    const sectionsToRender: { label: string; key: string; group?: string | null }[] = [];
    for (const [group, sections] of groupedConfig) {
      if (group) {
        sectionsToRender.push({ label: `${group}:`, key: `__group_${group}`, group: null });
      }
      for (const s of sections) {
        sectionsToRender.push({ label: s.label, key: s.sectionKey, group });
      }
    }

    for (const item of sectionsToRender) {
      const isGroupHeader = item.key.startsWith("__group_");
      const indent = item.group ? 20 : 0;
      const maxW = CONTENT_W - indent;

      if (y > PAGE_H - 230) {
        doc.addPage();
        drawSidebar(doc, settings.name);
        y = 80;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...SECTION_BLUE);
      doc.text(
        sanitizePdfText(isGroupHeader ? item.label : `${item.group ? "- " : ""}${item.label}:`),
        MARGIN_X + indent,
        y
      );
      y += 14;

      if (isGroupHeader) continue;

      const section = reactionsBySectionKey.get(item.key);
      const reactions = section?.reactions ?? [];
      const reactionLines = composeReactionLines(
        reactions.map((r) => ({ reaction: r.reaction, allergenName: r.allergen.commonName }))
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT);
      for (const line of reactionLines) {
        const wrapped = safeSplit(doc, line, maxW);
        for (const wline of wrapped) {
          if (y > PAGE_H - 230) {
            doc.addPage();
            drawSidebar(doc, settings.name);
            y = 80;
          }
          doc.text(wline, MARGIN_X + indent + 8, y);
          y += 12;
        }
      }
      y += 6;
    }
  }

  // ── Cross-reactivity notes (4-tier, conditional) ─────────────────────
  if (!isPatch) {
    const tiers = detectCrossReactivityTiers(report.sections);

    interface TierNote {
      readonly active: boolean;
      readonly heading: string | null;
      readonly body: string;
      readonly headingColor: readonly [number, number, number];
    }

    const tierNotes: readonly TierNote[] = [
      {
        active: tiers.severe,
        heading: "Advertencia: marcadores de reaccion sistemica",
        headingColor: [180, 30, 30],
        body:
          "Este panel detecta componentes asociados a reacciones sistemicas / anafilaxia " +
          "(proteinas de almacenamiento 2S/7S/11S, GRP tipo Pru p 7, alpha-gal). " +
          "Considerar diagnostico molecular (CRD) confirmatorio antes de exposicion " +
          "controlada o reintroduccion dietaria. Educar al paciente sobre signos de " +
          "anafilaxia y manejo con autoinyector de adrenalina si hay historia compatible.",
      },
      {
        active: tiers.standard,
        heading: null,
        headingColor: FOOTER,
        body:
          "Nota: este panel incluye alergenos con componentes de reactividad cruzada " +
          "(PR-10 / profilinas / tropomiosinas / LTPs). Algunas sensibilizaciones pueden " +
          "reflejar reactividad cruzada y no alergia clinica primaria; correlacionar con " +
          "componentes moleculares si la clinica lo amerita.",
      },
      {
        active: tiers.delayed,
        heading: null,
        headingColor: FOOTER,
        body:
          "Alpha-gal (galactosa-alfa-1,3-galactosa): las reacciones pueden ser tardias " +
          "(3-6 horas post-ingesta) y manifestarse como urticaria nocturna o anafilaxia " +
          "diferida. Investigar historia de mordedura de garrapata y considerar IgE " +
          "especifica anti-alpha-gal.",
      },
      {
        active: tiers.informational,
        heading: null,
        headingColor: FOOTER,
        body:
          "Componentes adicionales detectados (polcalcina / defensina / quitinasa): " +
          "marcadores de cross-reactivity con prevalencia y relevancia clinica " +
          "variables (sindrome latex-frutas para quitinasa; multi-sensibilizacion a " +
          "polenes para polcalcina). Interpretar segun historia clinica.",
      },
    ];

    for (const tn of tierNotes) {
      if (!tn.active) continue;
      if (y > PAGE_H - 260) {
        doc.addPage();
        drawSidebar(doc, settings.name);
        y = 80;
      }
      if (tn.heading) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...tn.headingColor);
        const headingLines = safeSplit(doc, tn.heading, CONTENT_W);
        for (const line of headingLines) {
          doc.text(line, MARGIN_X, y);
          y += 12;
        }
      }
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...FOOTER);
      const wrapped = safeSplit(doc, tn.body, CONTENT_W);
      for (const line of wrapped) {
        doc.text(line, MARGIN_X, y);
        y += 11;
      }
      y += 6;
    }
  }

  // ── Footer notes (operator-supplied) ─────────────────────────────────
  if (report.notes) {
    y += 4;
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    const wrapped = safeSplit(doc, report.notes, CONTENT_W);
    for (const line of wrapped) {
      doc.text(line, MARGIN_X, y);
      y += 11;
    }
  }

  // ── Nomenclature disclaimer (Stethoscope icon, EAACI 2023 verbatim) ──
  if (!isPatch) {
    if (y > PAGE_H - 270) {
      doc.addPage();
      drawSidebar(doc, settings.name);
      y = 80;
    }
    y += 6;
    y = drawSectionTitle({ doc, y, title: "NOMENCLATURA", iconDataUrl: iconStetho });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...FOOTER);
    const wrapped = safeSplit(doc, EAACI_2023_NOMENCLATURE, CONTENT_W);
    for (const line of wrapped) {
      doc.text(line, MARGIN_X, y);
      y += 10;
    }
  }

  // ── Signature block (lower-right) ────────────────────────────────────
  const sigBoxX = PAGE_W - 280;
  const sigBoxY = PAGE_H - 230;

  if (settings.signatureUrl) {
    const sigData = await loadAsDataUrl(settings.signatureUrl);
    if (sigData) {
      const fmt = inferImageFormat(sigData);
      if (fmt !== "SVG") {
        try {
          doc.addImage(sigData, fmt, sigBoxX, sigBoxY, 130, 60);
        } catch (err) {
          console.warn("[exam-reports/pdf] signature addImage failed", err);
        }
      }
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(sanitizePdfText(report.doctorName.toUpperCase()), sigBoxX, sigBoxY + 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(sanitizePdfText(report.doctorSpecialty.toUpperCase()), sigBoxX, sigBoxY + 90);
  if (report.doctorRut) {
    doc.setTextColor(...FOOTER);
    doc.text(sanitizePdfText(`RUT: ${report.doctorRut}`), sigBoxX, sigBoxY + 101);
  }
  const sup = settings.superintendenciaNumber;
  doc.setTextColor(...FOOTER);
  doc.text(
    sanitizePdfText(`Prestador Superintendencia de Salud N: ${sup ?? "—"}`),
    sigBoxX,
    sigBoxY + 112
  );

  // ── Footer block (address / web / email / phones) ───────────────────
  let footerY = PAGE_H - 110;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, footerY - 5, CONTENT_RIGHT, footerY - 5);

  if (report.reagents || report.technique) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...FOOTER);
    if (report.reagents) {
      doc.text(sanitizePdfText(`Reactivos: ${report.reagents}`), MARGIN_X, footerY);
      footerY += 11;
    }
    if (report.technique) {
      doc.text(sanitizePdfText(`Tecnica: ${report.technique}`), MARGIN_X, footerY);
      footerY += 11;
    }
    footerY += 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FOOTER);
  doc.text(sanitizePdfText(settings.address), MARGIN_X, footerY);
  footerY += 10;
  doc.text(sanitizePdfText(settings.website), MARGIN_X, footerY);
  footerY += 10;
  doc.text(sanitizePdfText(settings.email), MARGIN_X, footerY);
  footerY += 10;
  if (settings.websiteSecondary) {
    doc.text(sanitizePdfText(settings.websiteSecondary), MARGIN_X, footerY);
    footerY += 10;
  }

  // Phones (right side)
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  const phoneRightX = CONTENT_RIGHT - 5;
  doc.text(sanitizePdfText(settings.phoneWhatsapp), phoneRightX, PAGE_H - 80, { align: "right" });
  doc.text(sanitizePdfText(settings.phoneLandline), phoneRightX, PAGE_H - 68, { align: "right" });

  // ── Ley 21.719 footer (small print, bottom of page) ─────────────────
  const dataController =
    [settings.legalName ?? settings.name, settings.rut ? `RUT ${settings.rut}` : null]
      .filter(Boolean)
      .join(" - ") || settings.name;
  const privacyEmail = settings.privacyContactEmail ?? settings.email;
  const privacyUrl = settings.privacyPolicyUrl ?? "/privacidad";
  const leyText =
    `Responsable de datos: ${dataController}. ` +
    `Finalidad: prestacion de salud (Ley 21.719 art. 16). ` +
    `Derechos ARCO+P: ${privacyEmail} - ${privacyUrl}.`;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(...FOOTER);
  const leyWrapped = safeSplit(doc, leyText, CONTENT_W);
  let leyY = PAGE_H - 32;
  for (const line of leyWrapped) {
    doc.text(line, MARGIN_X, leyY);
    leyY += 8;
  }

  // POE reference (small print bottom)
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(...FOOTER);
  doc.text(sanitizePdfText("POE-ALG-TC-001 v1.0 (Mayo 2026) - Bioalergia"), MARGIN_X, PAGE_H - 12);

  return doc.output("blob");
}

/**
 * Convenience: download the PDF immediately.
 */
export async function downloadExamReportPdf(
  report: PdfReportInput,
  settings: ClinicSettingsLite,
  filename: string
): Promise<void> {
  const blob = await generateExamReportPdf(report, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ── Exposed for tests (aspect ratio + EAACI wording verification) ───────
export const __pdfTestExports = {
  BIOALERGIA_ASPECT,
  AAAEIC_ASPECT,
  LOGO_H,
  BIOALERGIA_W,
  AAAEIC_W,
  EAACI_2023_NOMENCLATURE,
  interpretPapule,
  sanitizePdfText,
  hasCrossReactiveAllergens,
};
