import * as XLSX from "xlsx";

export const SKIN_TEST_PARSER_VERSION = "2026-05-05.4";

export interface SkinTestIssue {
  code: string;
  message: string;
  severity: "error" | "info" | "warning";
}

export interface ParsedSkinTestHeader {
  ageLabel: null | string;
  patientEmail: null | string;
  patientName: null | string;
  patientPhone: null | string;
  patientRut: null | string;
  panelTitle: null | string;
  testDate: null | string;
}

export interface ParsedSkinTestResult {
  section: string;
  code: null | string;
  allergenName: string;
  papuleMm: null | number;
  erythemaMm: null | number;
  rawPapule: null | string;
  rawErythema: null | string;
  controlType: "NEGATIVE" | "POSITIVE" | null;
  sortOrder: number;
  rawCells: Record<string, unknown>;
}

export interface ParsedSkinTestInterpretation {
  address: null | string;
  clinicalNote: null | string;
  nonConclusiveDueToHyperreactivity: boolean;
  physicianName: null | string;
  physicianSpecialty: null | string;
  suggestedEvaluation: null | string;
  website: null | string;
}

export interface ParsedSkinTestWorkbook {
  confidence: number;
  header: ParsedSkinTestHeader;
  interpretation: ParsedSkinTestInterpretation;
  issues: SkinTestIssue[];
  results: ParsedSkinTestResult[];
}

interface CellPoint {
  col: number;
  row: number;
  text: string;
}

const MONTHS: Record<string, number> = {
  abril: 4,
  agosto: 8,
  agsoto: 8,
  dciembre: 12,
  dieciembre: 12,
  diciembrre: 12,
  diciembre: 12,
  enero: 1,
  febrero: 2,
  julio: 7,
  junio: 6,
  marzo: 3,
  mayo: 5,
  noviembre: 11,
  octubre: 10,
  septiembre: 9,
  setiembre: 9,
};

const SECTION_STOPWORDS = new Set(["mm", "p", "e", "+", "-", "++", "+++", "+?", "ir", "nt"]);

export async function parseSkinTestWorkbookBuffer(buffer: Buffer): Promise<ParsedSkinTestWorkbook> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, cellFormula: true, cellHTML: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return emptyParsedWorkbook([
      { code: "empty_workbook", message: "El archivo no tiene hojas.", severity: "error" },
    ]);
  }
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return emptyParsedWorkbook([
      { code: "empty_workbook", message: "El archivo no tiene hojas.", severity: "error" },
    ]);
  }
  return parseSkinTestWorksheet(ws);
}

export function parseSkinTestWorksheet(worksheet: XLSX.WorkSheet): ParsedSkinTestWorkbook {
  const cells = collectCells(worksheet);
  const issues: SkinTestIssue[] = [];
  const title = findCell(
    cells,
    /(?:(?:multi|prick)?\s*test\s+cut[aá]neo|prick\s*test\s+aines|estandar\s+aines|^prick\s*test$|estandar\s+europeo|test\s+de\s+parche\s+alimentario|test\s+cut[aá]neo\s+alimentario)/i
  );
  const panelTitle = findPanelTitle(cells, title);
  const header = extractHeader(cells);
  header.panelTitle = panelTitle;

  if (!title) {
    issues.push({
      code: "missing_title",
      message: "No se encontró el título MULTITEST CUTANEO.",
      severity: "warning",
    });
  }
  if (!header.patientRut) {
    issues.push({ code: "missing_rut", message: "No se encontró RUT válido.", severity: "error" });
  }
  if (!header.testDate) {
    issues.push({
      code: "missing_date",
      message: "No se encontró fecha válida.",
      severity: "error",
    });
  }

  const results = extractResults(worksheet, cells, title?.row ?? 1, issues);
  const interpretation = extractInterpretation(cells);
  if (results.length === 0) {
    issues.push({
      code: "missing_results",
      message: "No se encontraron resultados de alérgenos/control.",
      severity: "error",
    });
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const confidence = Math.max(0, Math.min(100, 100 - errorCount * 35 - warningCount * 10));

  return { confidence, header, interpretation, issues, results };
}

function emptyParsedWorkbook(issues: SkinTestIssue[]): ParsedSkinTestWorkbook {
  return {
    confidence: 0,
    header: {
      ageLabel: null,
      patientEmail: null,
      patientName: null,
      patientPhone: null,
      patientRut: null,
      panelTitle: null,
      testDate: null,
    },
    interpretation: emptyInterpretation(),
    issues,
    results: [],
  };
}

function emptyInterpretation(): ParsedSkinTestInterpretation {
  return {
    address: null,
    clinicalNote: null,
    nonConclusiveDueToHyperreactivity: false,
    physicianName: null,
    physicianSpecialty: null,
    suggestedEvaluation: null,
    website: null,
  };
}

function collectCells(ws: XLSX.WorkSheet): CellPoint[] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const cells: CellPoint[] = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (!cell || cell.t === "z") continue;
      const text = getCellText(cell).trim();
      if (text) cells.push({ col: C + 1, row: R + 1, text });
    }
  }
  return cells;
}

function getCellText(cell: XLSX.CellObject): string {
  if (cell.t === "d") {
    const d = cell.v as Date;
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  if (cell.w != null) return cell.w;
  if (cell.v == null) return "";
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  return String(cell.v);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findCell(cells: CellPoint[], pattern: RegExp): CellPoint | null {
  return cells.find((cell) => pattern.test(normalizeText(cell.text))) ?? null;
}

function findPanelTitle(cells: CellPoint[], title: CellPoint | null): null | string {
  if (!title) return null;
  const normalized = normalizeText(title.text);
  if (/prick\s*test\s+aines/i.test(normalized)) return normalized;
  // European standard patch test: the title cell IS the panel identifier
  if (/estandar\s+europeo/i.test(normalized)) return normalized;
  const sameOrNextRows = cells
    .filter((cell) => cell.row > title.row && cell.row <= title.row + 2)
    .map((cell) => cell.text.trim())
    .filter((text) => text && !/nombre|rut|fecha|edad|correo|celular/i.test(text));
  return sameOrNextRows[0] ?? null;
}

function extractHeader(cells: CellPoint[]): ParsedSkinTestHeader {
  const joined = cells.map((cell) => cell.text).join("\n");
  const name =
    extractLabelValue(joined, /nombre\s*:?\s*([^\n\r]+)/i) ?? extractRowLabelValue(cells, "nombre");
  const rut = normalizeRut(
    extractLabelValue(joined, /rut\s*:?\s*([0-9.\-\skK]+)/i) ??
      extractRowLabelValue(cells, "rut") ??
      extractStandaloneRut(cells)
  );
  const age =
    extractLabelValue(joined, /edad\s*:?\s*([^\n\r]+)/i) ?? extractRowLabelValue(cells, "edad");
  // Try each date candidate in order; extractLabelValue may return a truncated partial
  // value (e.g. "16" from "16   -  10  -2025") that is non-null but unparseable, so
  // we run parseDateToISO on each candidate rather than relying on the ?? chain.
  const testDate =
    parseDateToISO(extractLabelValue(joined, /fecha[^:\n\r]*:[^\S\n]*(\S[^\n\r]*)/i)) ??
    parseDateToISO(extractRowLabelValue(cells, "fecha del test")) ??
    parseDateToISO(extractRowLabelValue(cells, "fecha"));
  const email = extractEmail(joined);
  const phone =
    extractLabelValue(joined, /celular\s*:?\s*([+0-9\s]+)/i) ??
    extractRowLabelValue(cells, "celular");

  return {
    ageLabel: cleanHeaderValue(age),
    patientEmail: email,
    patientName: cleanHeaderValue(name),
    patientPhone: cleanHeaderValue(phone)?.replace(/\s+/g, "") ?? null,
    patientRut: rut,
    panelTitle: null,
    testDate,
  };
}

function extractInterpretation(cells: CellPoint[]): ParsedSkinTestInterpretation {
  const lines = cells.map((cell) => cell.text.trim()).filter(Boolean);
  const noteLines = lines.filter((line) =>
    /cex|piel\s+hiperreactiva|urticaria|pricktest|concluyente|evaluaci[oó]n|especialidad|ige|autoinmunidad/i.test(
      line
    )
  );
  const clinicalNote = compactLines(noteLines);
  const suggestedEvaluation = compactLines(
    noteLines.filter((line) => /evaluaci[oó]n|especialidad|ige|autoinmunidad/i.test(line))
  );
  const physicianName = lines.find((line) => /\bdr\.?\s+/i.test(line)) ?? null;
  const physicianSpecialty =
    lines.find((line) => /alerg[oó]logo|inmun[oó]logo/i.test(line)) ?? null;
  const website =
    lines.find((line) => /(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}/i.test(line)) ?? null;
  const address =
    lines.find((line) => /\b(?:san\s+mart[ií]n|o'?higgins|concepci[oó]n|of\s*\d+)/i.test(line)) ??
    null;
  const normalizedNote = normalizeText(clinicalNote ?? "");

  return {
    address,
    clinicalNote,
    nonConclusiveDueToHyperreactivity:
      /piel hiperreactiva/i.test(normalizedNote) ||
      (/pricktest/i.test(normalizedNote) && /no es concluyente/i.test(normalizedNote)),
    physicianName,
    physicianSpecialty,
    suggestedEvaluation,
    website,
  };
}

function compactLines(lines: string[]): null | string {
  const cleaned = lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join("\n") : null;
}

function extractLabelValue(text: string, pattern: RegExp): null | string {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  return match[1].split(/\s{2,}|\t/)[0]?.trim() || null;
}

function extractRowLabelValue(cells: CellPoint[], label: string): null | string {
  const normalizedLabel = normalizeText(label).toLowerCase();
  for (const cell of cells) {
    const cellText = normalizeText(cell.text);
    const lower = cellText.toLowerCase();
    if (!new RegExp(`^${normalizedLabel}\\b`).test(lower)) continue;

    const inline = cell.text.replace(new RegExp(`^\\s*${label}\\s*:?(.*)$`, "i"), "$1").trim();
    if (inline && inline !== ":") return inline.replace(/^:\s*/, "").trim();

    const sameRowCandidates = cells
      .filter(
        (candidate) =>
          candidate.row === cell.row &&
          candidate.col > cell.col &&
          candidate.col <= cell.col + 6 &&
          candidate.text.trim() !== ":"
      )
      .sort((left, right) => left.col - right.col);
    const value = sameRowCandidates.find(
      (candidate) =>
        !/^(?:nombre|rut|edad|fecha|correo|celular)$/i.test(normalizeText(candidate.text)) &&
        !/^:$/.test(candidate.text.trim())
    );
    if (value?.text.trim()) return value.text.trim().replace(/^:\s*/, "").trim();
  }
  return null;
}

function extractStandaloneRut(cells: CellPoint[]): null | string {
  const rutPattern = /\b(?:\d{1,2}[\s.]?\d{3}[\s.]?\d{3}|\d{7,8})\s*-\s*[\dkK]\b/;
  const candidate = cells
    .filter((cell) => cell.row <= 12)
    .sort((left, right) => left.row - right.row || left.col - right.col)
    .find((cell) => rutPattern.test(cell.text));
  return candidate?.text.match(rutPattern)?.[0] ?? null;
}

function cleanHeaderValue(value: null | string): null | string {
  if (!value) return null;
  const cleaned = value.replace(/\b(edad|fecha|rut|correo|celular)\b\s*:?.*$/i, "").trim();
  return cleaned || null;
}

function extractEmail(text: string): null | string {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase() ?? null;
}

export function normalizeRut(value: null | string): null | string {
  if (!value) return null;
  const compact = value.replace(/[^0-9kK]/g, "").toUpperCase();
  // RUT body must be 7-8 digits (1.000.000 – 99.999.999), plus 1 check digit = 8-9 total
  if (compact.length < 8 || compact.length > 9) return null;
  const body = compact.slice(0, -1);
  const dv = compact.slice(-1);
  return `${Number(body).toLocaleString("es-CL")}-${dv}`;
}

export function parseDateToISO(value: null | string): null | string {
  if (!value) return null;
  const text = normalizeText(value)
    .toLowerCase()
    .replace(/(\d+)de\b/g, "$1 de")
    .replace(/\s+del\s+/g, " ")
    .replace(/\s+de\s+/g, " ")
    .replace(/\s+de\s+/g, " "); // second pass for "de de" doubles
  const isoLike = text.match(/\b(\d{4})\s*[-/.,]\s*(\d{1,2})\s*[-/.,]\s*(\d{1,2})\b/);
  if (isoLike) {
    const year = Number(isoLike[1]);
    const month = Number(isoLike[2]);
    const day = Number(isoLike[3]);
    return formatISODate(year, month, day);
  }
  // handle missing second separator: "12/102018" → day=12, month=10, year=2018
  const missingLastSep = text.match(/\b(\d{1,2})\s*[-/.,](\d{2})(\d{4})\b/);
  if (missingLastSep) {
    const day = Number(missingLastSep[1]);
    const month = Number(missingLastSep[2]);
    const year = normalizeYear(Number(missingLastSep[3]));
    return formatISODate(year, month, day);
  }
  const numeric = text.match(/\b(\d{1,2})\s*[-/.,]\s*(\d{1,2})\s*[-/.,]\s*(\d{2,4})\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = normalizeYear(Number(numeric[3]));
    return formatISODate(year, month, day);
  }
  const written = text.match(/\b(\d{1,2})[\s-]+([a-z]+)[\s-]+(\d{2,4})\b/);
  if (written) {
    const day = Number(written[1]);
    const rawMonth = written[2] ?? "";
    // handle "mayode" type concatenations — strip trailing "de" if month not found
    const month = MONTHS[rawMonth] ?? MONTHS[rawMonth.replace(/de$/, "")];
    const year = normalizeYear(Number(written[3]));
    if (month) return formatISODate(year, month, day);
  }
  return null;
}

function normalizeYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

function formatISODate(year: number, month: number, day: number): null | string {
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function extractResults(
  ws: XLSX.WorkSheet,
  cells: CellPoint[],
  minRow: number,
  issues: SkinTestIssue[]
): ParsedSkinTestResult[] {
  const results: ParsedSkinTestResult[] = [];
  let currentSectionByBlock = new Map<number, string>();
  let sortOrder = 0;
  const maxRow = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).e.r + 1 : minRow;

  for (let rowNumber = minRow + 1; rowNumber <= maxRow; rowNumber += 1) {
    const rowTexts = rowToTexts(ws, rowNumber);
    const nonEmpty = rowTexts.filter((cell) => cell.text);
    if (nonEmpty.length === 0) continue;

    const hasResultCandidate = nonEmpty.some(
      (cell) => normalizeCode(cell.text) || /control\s+(positivo|negativo)/i.test(cell.text)
    );
    const sectionCells = nonEmpty.filter((cell) => isSectionLabel(cell.text));
    if (sectionCells.length > 0) {
      currentSectionByBlock = new Map(currentSectionByBlock);
      for (const section of sectionCells) {
        if (isAllergenNameCell(nonEmpty, section)) continue;
        currentSectionByBlock.set(blockForColumn(section.col), normalizeSection(section.text));
      }
      if (!hasResultCandidate) continue;
    }
    if (!hasResultCandidate) {
      continue;
    }

    const rowResults = extractResultRowsFromRow(
      ws,
      rowNumber,
      nonEmpty,
      currentSectionByBlock,
      sortOrder
    );
    for (const result of rowResults) {
      sortOrder += 1;
      results.push({ ...result, sortOrder });
    }
  }

  const suspiciousRows = cells.filter(
    (cell) =>
      cell.row > minRow &&
      /\b(control|positivo|negativo|[A-Z]\d{1,2}|MA|MC)\b/i.test(cell.text) &&
      !results.some((result) => result.rawCells.row === cell.row)
  );
  if (suspiciousRows.length > 0 && results.length === 0) {
    issues.push({
      code: "unparsed_candidate_rows",
      message: "Se detectaron filas candidatas, pero no se pudieron convertir a resultados.",
      severity: "warning",
    });
  }

  return results;
}

function rowToTexts(ws: XLSX.WorkSheet, rowNumber: number): Array<{ col: number; text: string }> {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const cells: Array<{ col: number; text: string }> = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: rowNumber - 1, c: C });
    const cell = ws[addr] as XLSX.CellObject | undefined;
    cells.push({ col: C + 1, text: cell && cell.t !== "z" ? getCellText(cell).trim() : "" });
  }
  return cells;
}

function isSectionLabel(value: string): boolean {
  const text = normalizeText(value).toLowerCase();
  if (!text || SECTION_STOPWORDS.has(text)) return false;
  if (/control\s+(positivo|negativo)/i.test(text)) return false;
  if (/^panel\s+\d+\s*$/i.test(text)) return true;
  return /^[A-ZÁÉÍÓÚÑ\s/]+$/i.test(value) && text.length >= 4 && !/\d/.test(text);
}

function normalizeSection(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}

function blockForColumn(col: number): number {
  return Math.floor((col - 1) / 5);
}

function extractResultRowsFromRow(
  ws: XLSX.WorkSheet,
  rowNumber: number,
  cells: Array<{ col: number; text: string }>,
  sectionByBlock: Map<number, string>,
  sortOrderBase: number
): ParsedSkinTestResult[] {
  const results: ParsedSkinTestResult[] = [];
  const ainesResult = extractAinesResultFromRow(ws, rowNumber, cells, sortOrderBase);
  if (ainesResult) {
    results.push(ainesResult);
    return results;
  }

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    if (!cell?.text) continue;
    const code = normalizeCode(cell.text);
    const isControl = /control\s+(positivo|negativo)/i.test(cell.text);
    if (!code && !isControl) continue;

    const nameCell = isControl ? cell : cells[index + 1];
    const allergenName = isControl ? normalizeText(cell.text) : normalizeText(nameCell?.text ?? "");
    if (!allergenName || allergenName.length < 2) continue;
    if (isResultValue(allergenName)) continue;
    if (!isControl && /^panel\s+\d+\b/i.test(normalizeText(allergenName))) continue;
    if (!isControl && (normalizeCode(allergenName) || allergenName.startsWith(":"))) continue;

    const numericCells = collectMetricCells(cells, index + (isControl ? 1 : 2), isControl);
    if (numericCells.length === 0) continue;
    const byMetric = assignResultMetrics(ws, rowNumber, numericCells);
    // When no metric header found, use positional fallback but only for cells within
    // 3 columns of the code cell — prevents adjacent-panel allergen numbers (which are
    // also valid isResultValue integers) from being mistaken for measurements.
    const nearCells = byMetric.sawHeader ? numericCells : numericCells.filter((c) => c.col <= cell.col + 3);
    const papule = byMetric.sawHeader ? byMetric.papule : (nearCells[0]?.text ?? null);
    const erythema = byMetric.sawHeader ? byMetric.erythema : (nearCells[1]?.text ?? null);
    if (!byMetric.sawHeader && nearCells.length === 0) continue;
    const section = isControl
      ? "Controles"
      : (sectionByBlock.get(blockForColumn(cell.col)) ?? "Sin sección");

    results.push({
      allergenName,
      code,
      controlType: isControl ? (/negativo/i.test(cell.text) ? "NEGATIVE" : "POSITIVE") : null,
      erythemaMm: parseMm(erythema),
      papuleMm: parseMm(papule),
      rawCells: {
        codeColumn: cell.col,
        row: sortOrderBase + results.length + 1,
        sourceRow: cell.text,
      },
      rawErythema: erythema,
      rawPapule: papule,
      section,
      sortOrder: sortOrderBase + results.length + 1,
    });
  }
  return results;
}

function extractAinesResultFromRow(
  ws: XLSX.WorkSheet,
  rowNumber: number,
  cells: Array<{ col: number; text: string }>,
  sortOrderBase: number
): null | ParsedSkinTestResult {
  const nameCell = cells.find((cell) => {
    const text = normalizeText(cell.text);
    return /^\d{1,2}\s+[A-ZÁÉÍÓÚÑ]/i.test(text) || /^control\s+(positivo|negativo)\b/i.test(text);
  });
  if (!nameCell) return null;

  const normalizedName = normalizeText(nameCell.text);
  const numbered = normalizedName.match(/^(\d{1,2})\s+(.+)$/);
  const isControl = /^control\s+(positivo|negativo)\b/i.test(normalizedName);
  const code = numbered?.[1] ?? null;
  const allergenName = numbered?.[2] ?? normalizedName;
  if (!isControl && !code) return null;

  const numericCells = cells
    .filter((cell) => {
      if (cell.col >= nameCell.col || !isResultValue(cell.text)) return false;
      const label = findMetricHeader(ws, rowNumber, cell.col);
      return label === null || label === "P" || label === "E" || label === "48H" || label === "96H";
    })
    .sort((left, right) => left.col - right.col)
    .slice(-2);
  if (numericCells.length === 0) return null;

  const byMetric = assignResultMetrics(ws, rowNumber, numericCells);
  const papule = byMetric.sawHeader
    ? byMetric.papule
    : numericCells.length > 1
      ? (numericCells[0]?.text ?? null)
      : null;
  const erythema = byMetric.sawHeader
    ? byMetric.erythema
    : numericCells.length > 1
      ? (numericCells[1]?.text ?? null)
      : (numericCells[0]?.text ?? null);

  return {
    allergenName,
    code,
    controlType: isControl ? (/negativo/i.test(normalizedName) ? "NEGATIVE" : "POSITIVE") : null,
    erythemaMm: parseMm(erythema),
    papuleMm: parseMm(papule),
    rawCells: {
      codeColumn: nameCell.col,
      row: sortOrderBase + 1,
      sourceRow: nameCell.text,
    },
    rawErythema: erythema,
    rawPapule: papule,
    section: isControl ? "Controles" : "AINES",
    sortOrder: sortOrderBase + 1,
  };
}

function isAllergenNameCell(
  cells: Array<{ col: number; text: string }>,
  cell: { col: number; text: string }
) {
  if (/^panel\s+\d+\s*$/i.test(normalizeText(cell.text))) return false;
  const previous = [...cells].reverse().find((candidate) => candidate.col < cell.col);
  return previous
    ? Boolean(normalizeCode(previous.text)) &&
        (!isResultValue(previous.text) || cell.col - previous.col <= 1)
    : false;
}

function collectMetricCells(
  cells: Array<{ col: number; text: string }>,
  startIndex: number,
  isControl: boolean
): Array<{ col: number; text: string }> {
  const metricCells: Array<{ col: number; text: string }> = [];
  const maxMetricCells = 4;

  for (let index = startIndex; index < cells.length; index += 1) {
    const candidate = cells[index];
    if (!candidate?.text) continue;
    if (isResultValue(candidate.text)) {
      metricCells.push(candidate);
      if (metricCells.length >= maxMetricCells) break;
      continue;
    }
    if (normalizeCode(candidate.text) || /control\s+(positivo|negativo)/i.test(candidate.text)) {
      break;
    }
  }

  return metricCells;
}

type MetricLabel = "%" | "48H" | "96H" | "E" | "N" | "P";

function assignResultMetrics(
  ws: XLSX.WorkSheet,
  rowNumber: number,
  numericCells: Array<{ col: number; text: string }>
): { erythema: null | string; papule: null | string; sawHeader: boolean } {
  let papule: null | string = null;
  let erythema: null | string = null;
  let sawHeader = false;
  for (const cell of numericCells) {
    const label = findMetricHeader(ws, rowNumber, cell.col);
    if (label === "P" || label === "48H") {
      sawHeader = true;
      papule = cell.text;
    } else if (label === "E" || label === "96H") {
      sawHeader = true;
      erythema = cell.text;
    } else if (label === "%" || label === "N") {
      // Concentration or ordinal column — not a reaction measurement
      sawHeader = true;
    }
  }
  return { erythema, papule, sawHeader };
}

function findMetricHeader(ws: XLSX.WorkSheet, rowNumber: number, col: number): MetricLabel | null {
  for (let row = rowNumber - 1; row >= Math.max(1, rowNumber - 30); row -= 1) {
    const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
    const cell = ws[addr] as XLSX.CellObject | undefined;
    const value = cell && cell.t !== "z" ? normalizeText(getCellText(cell)).toUpperCase() : "";
    if (value === "P" || value === "E") return value;
    if (value === "%") return "%";
    if (/^48\s*H/i.test(value)) return "48H";
    if (/^96\s*H/i.test(value)) return "96H";
    if (/^N[°O]?$/i.test(value) || value === "NUM" || value === "N°") return "N";
  }
  return null;
}

function normalizeCode(value: string): null | string {
  const text = value.trim().toUpperCase();
  if (text === "P" || text === "E") return null;
  if (/^[A-Z]{2,3}$/.test(text) && text !== "MA" && text !== "MC") return null;
  if (/^(?:[A-Z]{1,3}\d{0,2}|\d{1,2})$/.test(text)) return text;
  return null;
}

function isResultValue(value: string): boolean {
  const v = value.trim();
  // Numeric measurement (mm or similar)
  if (/^<?\s*\d+(?:[.,]\d+)?\s*$/.test(v)) return true;
  // Patch test grading notation: -, +, ++, +++, +?, IR, NT
  if (/^(?:\+{1,3}\??|-|IR|NT)$/i.test(v)) return true;
  return false;
}

function parseMm(value: null | string): null | number {
  if (!value) return null;
  const normalized = value.replace("<", "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
