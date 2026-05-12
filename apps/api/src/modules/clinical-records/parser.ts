import xlsx from "xlsx";

// Ficha clínica xlsx parser. Designed for the multi-year corpus
// produced by Dr. Martinez's consultorio (2018-2026). The clinic's
// template drifts year over year — header consultorio info lines,
// presence of TELEFONO / ISAPRE / MADRE rows, anthropometric layout
// (separate cells vs inline `P: 7,500 T: 66 CC: 43`) — so the parser
// is anchor-based: locate the section markers (NOMBRE, EDAD, FECHA,
// HISTORIA, EXAMEN, DIAGNÓSTICO, INDICACIONES) and slurp the cells
// under each one until the next marker.
//
// Output shape mirrors what clinical_records expects (consultDate,
// patientName, ageLabel, history, physicalExam, diagnosis,
// indications[], weightKg, heightCm, headCircumferenceCm,
// anthropometric, rawHeader, rawSections). Issues (missing date,
// can't parse weight, etc.) come back as a structured array so the
// reprocess job can decide IMPORTED vs PENDING_REVIEW.

export const CLINICAL_RECORD_PARSER_VERSION = "0.1.0";

export type ClinicalRecordIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type ParsedClinicalRecord = {
  consultDate: string | null; // ISO yyyy-mm-dd
  patientName: string | null;
  ageLabel: string | null;
  history: string | null;
  physicalExam: string | null;
  diagnosis: string | null;
  indications: string[];
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
  anthropometric: Record<string, string>;
  rawHeader: Record<string, string>;
  rawSections: Record<string, string[]>;
  issues: ClinicalRecordIssue[];
  confidence: number; // 0..100
};

type Cell = string;
type Row = Cell[];

const SECTION_MARKERS = [
  "HISTORIA",
  "EXAMEN FÍSICO",
  "EXAMEN FISICO",
  "DIAGNÓSTICO",
  "DIAGNOSTICO",
  "INDICACIONES",
] as const;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rowsFromBuffer(buffer: Buffer): Row[] {
  const wb = xlsx.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];
  const json = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: false,
  });
  return json.map((row) => (row as unknown[]).map((c) => (c == null ? "" : String(c).trim())));
}

function findCellRight(row: Row, fromIdx: number): string {
  for (let i = fromIdx + 1; i < row.length; i++) {
    if (row[i]) return row[i]!;
  }
  return "";
}

function isSectionMarker(cellNorm: string): boolean {
  return SECTION_MARKERS.some(
    (m) => cellNorm === normalize(m) || cellNorm.startsWith(normalize(m))
  );
}

function classifySectionMarker(cellNorm: string): keyof ParsedClinicalRecord["rawSections"] | null {
  if (cellNorm.startsWith("HISTORIA")) return "history";
  if (cellNorm.startsWith("EXAMEN")) return "physicalExam";
  if (cellNorm.startsWith("DIAGNOSTICO") || cellNorm.startsWith("DIAGNÓSTICO")) return "diagnosis";
  if (cellNorm.startsWith("INDICACIONES")) return "indications";
  return null;
}

const SPANISH_MONTHS: Record<string, number> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  SETIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

export function parseSpanishDate(value: string): string | null {
  if (!value) return null;
  const norm = normalize(value);
  // Patterns observed:
  //   "11 DE ENERO DE 2024"
  //   "20 FEBRERO DE 2019"
  //   "03 DE DICIEMBRE DE DE 2018" (typo with double DE)
  //   "21 DE JULIO DE 2025"
  const m = norm.match(/(\d{1,2})\s+(?:DE\s+)?([A-Z]+)(?:\s+DE)?(?:\s+DE)?\s+(\d{4})/);
  if (m) {
    const day = Number.parseInt(m[1]!, 10);
    const month = SPANISH_MONTHS[m[2]!];
    const year = Number.parseInt(m[3]!, 10);
    if (month && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }
  // ISO fallback yyyy-mm-dd already normalized away by normalize(); try raw
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
  }
  // dd/mm/yyyy or dd-mm-yyyy
  const slash = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[2]!.padStart(2, "0")}-${slash[1]!.padStart(2, "0")}`;
  }
  return null;
}

function parseDecimal(value: string): number | null {
  if (!value) return null;
  // Chilean format uses comma as decimal: "7,830". Accept both.
  const cleaned = value.replace(/[^\d,.\-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractInlineAnthropometric(text: string, target: ParsedClinicalRecord): void {
  // Match patterns like "P: 8,100 T: 67,5 CC: 43,5" in any single cell.
  const matches = text.matchAll(/\b([A-ZÁÉÍÓÚÑ\/]+)\s*[:\-]\s*([\d.,]+)/g);
  for (const m of matches) {
    const key = normalize(m[1]!);
    const numTxt = m[2]!;
    target.anthropometric[key] = numTxt;
    if ((key === "P" || key === "PESO") && target.weightKg == null) {
      target.weightKg = parseDecimal(numTxt);
    }
    if ((key === "T" || key === "TALLA") && target.heightCm == null) {
      target.heightCm = parseDecimal(numTxt);
    }
    if (key === "CC" && target.headCircumferenceCm == null) {
      target.headCircumferenceCm = parseDecimal(numTxt);
    }
  }
}

export function parseClinicalRecordWorkbook(buffer: Buffer): ParsedClinicalRecord {
  const rows = rowsFromBuffer(buffer);
  const issues: ClinicalRecordIssue[] = [];

  const result: ParsedClinicalRecord = {
    consultDate: null,
    patientName: null,
    ageLabel: null,
    history: null,
    physicalExam: null,
    diagnosis: null,
    indications: [],
    weightKg: null,
    heightCm: null,
    headCircumferenceCm: null,
    anthropometric: {},
    rawHeader: {},
    rawSections: { history: [], physicalExam: [], diagnosis: [], indications: [] } as Record<
      string,
      string[]
    >,
    issues,
    confidence: 0,
  };

  if (rows.length === 0) {
    issues.push({ code: "empty_workbook", message: "Hoja vacía o ilegible.", severity: "error" });
    return result;
  }

  // Locate header markers (NOMBRE, EDAD, FECHA, etc.) and section markers.
  // Header markers expect the value in a sibling cell on the same row.
  let currentSection: keyof typeof result.rawSections | null = null;
  let inIndicationsBlock = false;
  let consultMarkerSeen = false;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]!.trim();
      if (!cell) continue;
      const norm = normalize(cell);

      if (norm.includes("CONSULTA MEDICA") || norm.includes("CONSULTA MEDICA PEGAR CUADERNO")) {
        consultMarkerSeen = true;
        continue;
      }

      if (norm === "NOMBRE" || norm.startsWith("NOMBRE ")) {
        const value = findCellRight(row, c);
        if (value && !result.patientName) {
          result.patientName = value;
          result.rawHeader.NOMBRE = value;
        }
        continue;
      }
      if (norm === "EDAD") {
        const value = findCellRight(row, c);
        if (value && !result.ageLabel) {
          result.ageLabel = value;
          result.rawHeader.EDAD = value;
        }
        continue;
      }
      if (norm === "FECHA") {
        const value = findCellRight(row, c);
        if (value && !result.consultDate) {
          const iso = parseSpanishDate(value);
          if (iso) result.consultDate = iso;
          result.rawHeader.FECHA = value;
        }
        continue;
      }
      if (norm === "TELEFONO" || norm === "TELÉFONO") {
        const value = findCellRight(row, c);
        if (value) result.rawHeader.TELEFONO = value;
        continue;
      }
      if (norm === "ISAPRE") {
        const value = findCellRight(row, c);
        if (value) result.rawHeader.ISAPRE = value;
        continue;
      }
      if (norm === "MADRE") {
        const value = findCellRight(row, c);
        if (value) result.rawHeader.MADRE = value;
        continue;
      }
      if (norm === "ADDRESS" || norm === "DIRECCION" || norm === "DIRECCIÓN") {
        const value = findCellRight(row, c);
        if (value) result.rawHeader.ADDRESS = value;
        continue;
      }

      // Section marker
      const sect = classifySectionMarker(norm);
      if (sect) {
        currentSection = sect;
        inIndicationsBlock = sect === "indications";
        // Sometimes the marker cell contains "HISTORIA: ..." with content inline.
        const inline = cell.replace(/^[^:]+:\s*/, "").trim();
        if (inline && inline.length > 1 && normalize(inline) !== norm) {
          result.rawSections[sect]!.push(inline);
        }
        // Capture the right-cell value too (e.g. EXAMEN FÍSICO  P/E  N).
        const right = findCellRight(row, c);
        if (right && !isSectionMarker(normalize(right))) {
          if (sect === "physicalExam") {
            extractInlineAnthropometric(right, result);
            result.rawSections.physicalExam!.push(right);
          } else if (sect !== "indications") {
            result.rawSections[sect]!.push(right);
          }
        }
        continue;
      }

      // Anthropometric labels in EXAMEN FÍSICO section.
      if (currentSection === "physicalExam") {
        if (/^(PESO|TALLA|CC)$/i.test(norm)) {
          const value = findCellRight(row, c);
          if (value) {
            result.anthropometric[norm] = value;
            const numeric = parseDecimal(value);
            if (numeric != null) {
              if (norm === "PESO") result.weightKg = numeric;
              if (norm === "TALLA") result.heightCm = numeric;
              if (norm === "CC") result.headCircumferenceCm = numeric;
            }
          }
          continue;
        }
        // Generic anthropometric label (P/E, P/T, T/E)
        if (/^[A-Z]{1,3}\/[A-Z]{1,3}$/.test(norm)) {
          const value = findCellRight(row, c);
          if (value) result.anthropometric[norm] = value;
          continue;
        }
      }

      // Indications: numbered list. Sometimes col 1 has the number, col 2+ has text.
      if (inIndicationsBlock) {
        const isNumberLabel = /^\d+\.?$/.test(cell);
        if (isNumberLabel) {
          const text = findCellRight(row, c);
          if (text) result.indications.push(text);
          continue;
        }
      }

      // Default: append to current section if active.
      if (currentSection) {
        // Skip footer / signature rows.
        if (norm.startsWith("DR ") || norm.includes("ALERGOLOGO") || norm.includes("INMUNOLOGO")) {
          currentSection = null;
          inIndicationsBlock = false;
          continue;
        }
        if (currentSection === "indications") {
          // Indication text without explicit number — append.
          extractInlineAnthropometric(cell, result);
          result.indications.push(cell);
        } else {
          extractInlineAnthropometric(cell, result);
          result.rawSections[currentSection]!.push(cell);
        }
      } else {
        // Pre-NOMBRE / pre-section header lines (consultorio address etc.)
        // are kept in rawHeader for debugging only.
        if (!result.rawHeader[`L${r}`]) result.rawHeader[`L${r}`] = cell;
      }
    }
  }

  // Collapse section arrays into joined strings for the SQL columns.
  result.history = result.rawSections.history!.join("\n").trim() || null;
  result.physicalExam = result.rawSections.physicalExam!.join("\n").trim() || null;
  result.diagnosis = result.rawSections.diagnosis!.join("\n").trim() || null;

  // Confidence + issues.
  if (!consultMarkerSeen) {
    issues.push({
      code: "missing_consulta_marker",
      message: "Falta el marcador 'CONSULTA MEDICA - PEGAR CUADERNO'.",
      severity: "warning",
    });
  }
  if (!result.patientName) {
    issues.push({ code: "missing_name", message: "No se encontró NOMBRE.", severity: "error" });
  }
  if (!result.consultDate) {
    issues.push({
      code: "missing_or_unparsed_date",
      message: "No se encontró FECHA o no se pudo parsear.",
      severity: "warning",
    });
  }
  if (!result.history && !result.physicalExam && !result.diagnosis) {
    issues.push({
      code: "empty_clinical_payload",
      message: "Sin contenido en HISTORIA / EXAMEN / DIAGNÓSTICO.",
      severity: "warning",
    });
  }

  let score = 0;
  if (consultMarkerSeen) score += 15;
  if (result.patientName) score += 25;
  if (result.consultDate) score += 20;
  if (result.history) score += 15;
  if (result.physicalExam) score += 10;
  if (result.diagnosis) score += 10;
  if (result.indications.length > 0) score += 5;
  result.confidence = Math.min(score, 100);

  return result;
}
