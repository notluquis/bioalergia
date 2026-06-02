// Utilidades compartidas para los generadores de PDF (cotización, presupuesto
// de inmunoterapia, certificado médico). Centraliza:
//   - Paleta de marca.
//   - Fuente embebida (IBM Plex Sans, subset) → portabilidad/PDF-A; el texto
//     se renderiza igual en cualquier visor/imprenta (golden 2026), a
//     diferencia de las Standard-14 no embebidas.
//   - Logo administrable: bytes desde una URL (R2/CDN, editable por el admin
//     en ClinicSettings) con cache en memoria + fallback al asset local.
//   - Helpers de texto (wrap) y moneda (CLP).
import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { type PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";

const ASSETS_DIR = path.resolve(import.meta.dirname, "../../../assets");
const FONTS_DIR = path.join(ASSETS_DIR, "fonts");
const LOGOS_DIR = path.join(ASSETS_DIR, "logos");

// ── Paleta de marca ──────────────────────────────────────────────────
export const PDF_COLORS = {
  accent: rgb(0.1, 0.4, 0.6),
  dark: rgb(0.15, 0.15, 0.15),
  gray: rgb(0.4, 0.4, 0.4),
  line: rgb(0.8, 0.8, 0.8),
  headerBg: rgb(0.93, 0.93, 0.93),
} as const;

// ── Fuente embebida (IBM Plex Sans) ──────────────────────────────────
let regularBytes: Uint8Array | null = null;
let boldBytes: Uint8Array | null = null;

function readFontBytes(): { regular: Uint8Array; bold: Uint8Array } {
  if (!regularBytes) {
    regularBytes = new Uint8Array(fs.readFileSync(path.join(FONTS_DIR, "IBMPlexSans-Regular.ttf")));
  }
  if (!boldBytes) {
    boldBytes = new Uint8Array(fs.readFileSync(path.join(FONTS_DIR, "IBMPlexSans-SemiBold.ttf")));
  }
  return { regular: regularBytes, bold: boldBytes };
}

export type PdfFonts = { font: PDFFont; bold: PDFFont };

/** Registra fontkit y embebe IBM Plex Sans (subset) en el documento. */
export async function loadPdfFonts(pdfDoc: PDFDocument): Promise<PdfFonts> {
  pdfDoc.registerFontkit(fontkit);
  const { regular, bold } = readFontBytes();
  const font = await pdfDoc.embedFont(regular, { subset: true });
  const boldFont = await pdfDoc.embedFont(bold, { subset: true });
  return { font, bold: boldFont };
}

// ── Logo (URL administrable + fallback local) ────────────────────────
const logoBytesCache = new Map<string, Uint8Array>();

async function fetchLogoBytes(url: string | null | undefined): Promise<Uint8Array | null> {
  if (url) {
    const cached = logoBytesCache.get(url);
    if (cached) return cached;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        logoBytesCache.set(url, bytes);
        return bytes;
      }
    } catch (error) {
      console.warn("No se pudo descargar el logo desde la URL:", error);
    }
  }
  // Fallback: asset local versionado (apps/api/assets/logos/bioalergia.png).
  const local = path.join(LOGOS_DIR, "bioalergia.png");
  if (fs.existsSync(local)) return new Uint8Array(fs.readFileSync(local));
  return null;
}

/**
 * Embebe el logo: descarga de `url` (ClinicSettings.logoUrl, R2/CDN) o usa el
 * fallback local. Soporta PNG/JPEG (pdf-lib no embebe WebP/AVIF — la subida de
 * logos de clínica se restringe a PNG/JPEG en el presign).
 */
export async function embedLogo(
  pdfDoc: PDFDocument,
  url?: string | null,
  fallbackName?: string
): Promise<PDFImage | null> {
  let bytes = await fetchLogoBytes(url);
  if (!bytes && fallbackName) {
    const local = path.join(LOGOS_DIR, fallbackName);
    if (fs.existsSync(local)) bytes = new Uint8Array(fs.readFileSync(local));
  }
  if (!bytes) return null;
  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    try {
      return await pdfDoc.embedJpg(bytes);
    } catch (error) {
      console.warn("Logo en formato no embebible (no PNG/JPEG):", error);
      return null;
    }
  }
}

/** Dibuja una imagen anclada por su esquina superior, escalada a `targetWidth`. */
export function drawImageTopLeft(
  page: PDFPage,
  img: PDFImage,
  opts: { x: number; topY: number; targetWidth: number; alignRight?: boolean }
): { width: number; height: number } {
  const scale = opts.targetWidth / img.width;
  const width = opts.targetWidth;
  const height = img.height * scale;
  const x = opts.alignRight ? opts.x - width : opts.x;
  page.drawImage(img, { x, y: opts.topY - height, width, height });
  return { width, height };
}

// ── Texto / moneda ───────────────────────────────────────────────────
const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function formatCLP(value: number): string {
  return clpFormatter.format(value);
}

/**
 * Metadata estándar del documento (Title/Author/Subject/Producer/Creator +
 * fechas). Mejora indexación, accesibilidad y prolijidad. NOTA: esto NO es
 * PDF/A completo — conformidad PDF/A-3 (OutputIntent sRGB + XMP + ICC) requiere
 * post-procesar con ghostscript/veraPDF; pdf-lib no la emite nativamente.
 */
export function setPdfMetadata(
  pdfDoc: PDFDocument,
  meta: { title: string; subject?: string; author?: string; keywords?: string[] }
): void {
  pdfDoc.setTitle(meta.title);
  if (meta.subject) pdfDoc.setSubject(meta.subject);
  pdfDoc.setAuthor(meta.author ?? "Bioalergia");
  pdfDoc.setCreator("Bioalergia Intranet");
  pdfDoc.setProducer("Bioalergia (pdf-lib)");
  if (meta.keywords?.length) pdfDoc.setKeywords(meta.keywords);
  const now = new Date();
  pdfDoc.setCreationDate(now);
  pdfDoc.setModificationDate(now);
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
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
