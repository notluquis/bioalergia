import jsPDF from "jspdf";
import type { ExamType, SkinReaction } from "@finanzas/orpc-contracts/exam-reports";

import { EXAM_TYPE_CONFIG, composeReactionLines } from "./exam-types";

/**
 * Generate the PDF informe in the exact layout of the source templates
 * the user provided. Pure-coordinate jspdf — no HTML2PDF / no headless
 * browser, no extra infra. Letter portrait (612 x 792 pt).
 *
 * Layout regions (pt, origin top-left):
 *   - Left BIOALERGIA sidebar: x 0-32, rotated 90° navy text on a
 *     light peach band — matches the printed templates' branded edge.
 *   - Header: logo top-centered + multi-line title centered below.
 *   - Body (x 60-555, y 130-660): patient block, CONCLUSION line,
 *     ALERGENOS TESTEADOS sections (grouped or flat), notes line.
 *   - Signature block: signature image (if uploaded) + doctor name +
 *     specialty, lower-right area.
 *   - Footer (y 700-770): address / web / email / phones + small
 *     branded logo. Pulled from ClinicSettings — no hardcoded strings.
 *
 * All copy comes from the report payload + ClinicSettings; nothing
 * here is clinic-specific so it will follow theme/branding edits the
 * admin UI applies.
 */

interface AllergenLite {
  id: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  pollenType: string | null;
}

interface PdfReaction {
  reaction: SkinReaction;
  allergen: AllergenLite;
}

interface PdfSection {
  sectionKey: string;
  label: string;
  reactions: PdfReaction[];
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
}

// Brand colors sampled from the source PDFs.
const NAVY: [number, number, number] = [12, 38, 84];
const SECTION_BLUE: [number, number, number] = [42, 95, 184];
const PEACH: [number, number, number] = [253, 217, 178];
const TEXT: [number, number, number] = [0, 0, 0];
const FOOTER: [number, number, number] = [80, 80, 80];

const PAGE_W = 612;
const PAGE_H = 792;
const SIDEBAR_W = 32;
const MARGIN_X = 60;
const CONTENT_RIGHT = PAGE_W - 50;

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
  } catch {
    return null;
  }
}

function inferImageFormat(dataUrl: string): "PNG" | "JPEG" | "SVG" {
  if (dataUrl.startsWith("data:image/svg")) return "SVG";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  return "PNG";
}

export async function generateExamReportPdf(
  report: PdfReportInput,
  settings: ClinicSettingsLite,
  options?: { logoUrl?: string }
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const config = EXAM_TYPE_CONFIG[report.examType];

  // ── Branded left sidebar ────────────────────────────────────────────
  doc.setFillColor(...PEACH);
  doc.rect(0, 0, SIDEBAR_W, PAGE_H, "F");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  // Rotated 90° (counter-clockwise = -90 in jspdf): text reads bottom-up
  // along the sidebar, matching the source PDFs.
  doc.text(settings.name.toUpperCase(), SIDEBAR_W / 2 + 7, PAGE_H - 80, {
    angle: 90,
    align: "left",
  });

  // ── Logo top-center ─────────────────────────────────────────────────
  // Falls back to text if the logo asset isn't reachable — never hard-fail.
  const logoUrl = options?.logoUrl ?? "/logo_bimi.svg";
  const logoData = await loadAsDataUrl(logoUrl);
  if (logoData) {
    const fmt = inferImageFormat(logoData);
    if (fmt !== "SVG") {
      // jspdf supports PNG/JPEG natively. SVG support requires svg2pdf
      // (extra dep) — skip silently if we got SVG, the title fills in.
      try {
        doc.addImage(logoData, fmt, MARGIN_X, 30, 160, 50);
      } catch {
        /* ignore — title below is enough */
      }
    }
  }

  // ── Title (multi-line, centered) ────────────────────────────────────
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  let y = 110;
  const titleLines = config.title.split("\n");
  for (const line of titleLines) {
    doc.text(line, PAGE_W / 2, y, { align: "center" });
    y += 18;
  }

  // ── Patient block ───────────────────────────────────────────────────
  y += 20;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const drawLabel = (label: string, value: string | null, yPos: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, MARGIN_X, yPos);
    const labelW = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.text(value ?? "—", MARGIN_X + labelW + 4, yPos);
  };
  drawLabel("NOMBRE: ", report.patient.fullName, y);
  y += 16;
  drawLabel("EDAD: ", report.patient.age, y);
  y += 16;
  drawLabel("RUT:  ", report.patient.rut, y);
  y += 28;

  // ── Conclusion + Allergens header ───────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("CONCLUSION EXAMEN: ", MARGIN_X, y);
  const concW = doc.getTextWidth("CONCLUSION EXAMEN: ");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT);
  doc.text(report.conclusionText, MARGIN_X + concW, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SECTION_BLUE);
  doc.text("ALERGENOS TESTEADOS:", MARGIN_X, y);
  y += 22;

  // ── Sections (with optional grouping) ───────────────────────────────
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
      // Print the group header once, then the subsections under it.
      sectionsToRender.push({ label: `${group}:`, key: `__group_${group}`, group: null });
    }
    for (const s of sections) {
      sectionsToRender.push({ label: s.label, key: s.sectionKey, group });
    }
  }

  for (const item of sectionsToRender) {
    const isGroupHeader = item.key.startsWith("__group_");
    const indent = item.group ? 20 : 0;
    const maxW = CONTENT_RIGHT - MARGIN_X - indent;

    // Page break if needed — leave room for signature block + footer.
    if (y > PAGE_H - 230) {
      doc.addPage();
      doc.setFillColor(...PEACH);
      doc.rect(0, 0, SIDEBAR_W, PAGE_H, "F");
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(settings.name.toUpperCase(), SIDEBAR_W / 2 + 7, PAGE_H - 80, {
        angle: 90,
        align: "left",
      });
      y = 80;
    }

    // Section label — group headers and subsection labels both bold,
    // colored blue to mirror the source PDF's accent.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...SECTION_BLUE);
    doc.text(isGroupHeader ? item.label : `${item.group ? "• " : ""}${item.label}:`, MARGIN_X + indent, y);
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
      const wrapped = doc.splitTextToSize(line, maxW);
      for (const wline of wrapped) {
        if (y > PAGE_H - 230) {
          doc.addPage();
          doc.setFillColor(...PEACH);
          doc.rect(0, 0, SIDEBAR_W, PAGE_H, "F");
          y = 80;
        }
        doc.text(wline, MARGIN_X + indent + 8, y);
        y += 12;
      }
    }
    y += 6;
  }

  // ── Footer notes (e.g. "*solo se considera reacción positiva...") ──
  if (report.notes) {
    y += 6;
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(report.notes, MARGIN_X, y);
    y += 14;
  }

  // ── Signature block (lower-right) ──────────────────────────────────
  const sigBoxX = PAGE_W - 280;
  const sigBoxY = PAGE_H - 220;

  if (settings.signatureUrl) {
    const sigData = await loadAsDataUrl(settings.signatureUrl);
    if (sigData) {
      const fmt = inferImageFormat(sigData);
      if (fmt !== "SVG") {
        try {
          doc.addImage(sigData, fmt, sigBoxX, sigBoxY, 130, 60);
        } catch {
          /* ignore */
        }
      }
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(report.doctorName.toUpperCase(), sigBoxX, sigBoxY + 78);
  doc.setFontSize(9);
  doc.text(report.doctorSpecialty.toUpperCase(), sigBoxX, sigBoxY + 90);

  // ── Footer (address / web / email / phones / reactivos / técnica) ──
  let footerY = PAGE_H - 95;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, footerY - 5, CONTENT_RIGHT, footerY - 5);

  if (report.reagents || report.technique) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...FOOTER);
    if (report.reagents) {
      doc.text(`Reactivos: ${report.reagents}`, MARGIN_X, footerY);
      footerY += 11;
    }
    if (report.technique) {
      doc.text(`Técnica: ${report.technique}`, MARGIN_X, footerY);
      footerY += 11;
    }
    footerY += 4;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FOOTER);
  doc.text(settings.address, MARGIN_X, footerY);
  footerY += 10;
  doc.text(settings.website, MARGIN_X, footerY);
  footerY += 10;
  doc.text(settings.email, MARGIN_X, footerY);
  footerY += 10;
  if (settings.websiteSecondary) {
    doc.text(settings.websiteSecondary, MARGIN_X, footerY);
    footerY += 10;
  }

  // Phones on the right side of the footer.
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  const phoneRightX = CONTENT_RIGHT - 5;
  doc.text(settings.phoneWhatsapp, phoneRightX, PAGE_H - 65, { align: "right" });
  doc.text(settings.phoneLandline, phoneRightX, PAGE_H - 53, { align: "right" });

  return doc.output("blob");
}

/**
 * Convenience: download the PDF immediately. Mirrors the certificates
 * module's UX (operator clicks "Generar" → file lands in Downloads).
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
