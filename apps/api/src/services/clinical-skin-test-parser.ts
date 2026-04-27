import ExcelJS from "exceljs";

export const SKIN_TEST_PARSER_VERSION = "2026-04-26.3";

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

type ExcelWorkbookBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

interface CellPoint {
  col: number;
  row: number;
  text: string;
}

const MONTHS: Record<string, number> = {
  abril: 4,
  agosto: 8,
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

const SECTION_STOPWORDS = new Set(["mm", "p", "e"]);

export async function parseSkinTestWorkbookBuffer(
  buffer: ExcelWorkbookBuffer
): Promise<ParsedSkinTestWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return emptyParsedWorkbook([
      { code: "empty_workbook", message: "El archivo no tiene hojas.", severity: "error" },
    ]);
  }
  return parseSkinTestWorksheet(worksheet);
}

export function parseSkinTestWorksheet(worksheet: ExcelJS.Worksheet): ParsedSkinTestWorkbook {
  const cells = collectCells(worksheet);
  const issues: SkinTestIssue[] = [];
  const title = findCell(
    cells,
    /(?:(?:multi|prick)\s*test\s+cut[aá]neo|prick\s*test\s+aines|^prick\s*test$)/i
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

function collectCells(worksheet: ExcelJS.Worksheet): CellPoint[] {
  const cells: CellPoint[] = [];
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellToText(cell).trim();
      if (text) {
        cells.push({ col: colNumber, row: rowNumber, text });
      }
    });
  });
  return cells;
}

function cellToText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
  }
  return String(value);
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
  if (/prick\s*test\s+aines/i.test(normalizeText(title.text))) {
    return normalizeText(title.text);
  }
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
  const dateRaw =
    extractLabelValue(joined, /fecha\s*:?\s*([^\n\r]+)/i) ?? extractRowLabelValue(cells, "fecha");
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
    testDate: parseDateToISO(dateRaw),
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
  if (compact.length < 2) return null;
  const body = compact.slice(0, -1);
  const dv = compact.slice(-1);
  return `${Number(body).toLocaleString("es-CL")}-${dv}`;
}

export function parseDateToISO(value: null | string): null | string {
  if (!value) return null;
  const text = normalizeText(value)
    .toLowerCase()
    .replace(/\s+de\s+/g, " ");
  const isoLike = text.match(/\b(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})\b/);
  if (isoLike) {
    const year = Number(isoLike[1]);
    const month = Number(isoLike[2]);
    const day = Number(isoLike[3]);
    return formatISODate(year, month, day);
  }
  const numeric = text.match(/\b(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = normalizeYear(Number(numeric[3]));
    return formatISODate(year, month, day);
  }
  const written = text.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{2,4})\b/);
  if (written) {
    const day = Number(written[1]);
    const month = MONTHS[written[2] ?? ""];
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
  worksheet: ExcelJS.Worksheet,
  cells: CellPoint[],
  minRow: number,
  issues: SkinTestIssue[]
): ParsedSkinTestResult[] {
  const results: ParsedSkinTestResult[] = [];
  let currentSectionByBlock = new Map<number, string>();
  let sortOrder = 0;

  for (let rowNumber = minRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rowTexts = rowToTexts(row);
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
      worksheet,
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

function rowToTexts(row: ExcelJS.Row): Array<{ col: number; text: string }> {
  const cells: Array<{ col: number; text: string }> = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cells.push({ col: colNumber, text: cellToText(cell).trim() });
  });
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
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  cells: Array<{ col: number; text: string }>,
  sectionByBlock: Map<number, string>,
  sortOrderBase: number
): ParsedSkinTestResult[] {
  const results: ParsedSkinTestResult[] = [];
  const ainesResult = extractAinesResultFromRow(worksheet, rowNumber, cells, sortOrderBase);
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
    const byMetric = assignResultMetrics(worksheet, rowNumber, numericCells);
    const papule = byMetric.sawHeader ? byMetric.papule : (numericCells[0]?.text ?? null);
    const erythema = byMetric.sawHeader ? byMetric.erythema : (numericCells[1]?.text ?? null);
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
  worksheet: ExcelJS.Worksheet,
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
    .filter((cell) => cell.col < nameCell.col && isResultValue(cell.text))
    .sort((left, right) => left.col - right.col)
    .slice(-2);
  if (numericCells.length === 0) return null;

  const byMetric = assignResultMetrics(worksheet, rowNumber, numericCells);
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
  return previous ? Boolean(normalizeCode(previous.text)) : false;
}

function collectMetricCells(
  cells: Array<{ col: number; text: string }>,
  startIndex: number,
  isControl: boolean
): Array<{ col: number; text: string }> {
  const metricCells: Array<{ col: number; text: string }> = [];
  const maxMetricCells = isControl ? 2 : 2;

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

function assignResultMetrics(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  numericCells: Array<{ col: number; text: string }>
): { erythema: null | string; papule: null | string; sawHeader: boolean } {
  let papule: null | string = null;
  let erythema: null | string = null;
  let sawHeader = false;
  for (const cell of numericCells) {
    const label = findMetricHeader(worksheet, rowNumber, cell.col);
    if (label === "P") {
      sawHeader = true;
      papule = cell.text;
    } else if (label === "E") {
      sawHeader = true;
      erythema = cell.text;
    }
  }
  return { erythema, papule, sawHeader };
}

function findMetricHeader(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  col: number
): "E" | "P" | null {
  for (let row = rowNumber - 1; row >= Math.max(1, rowNumber - 30); row -= 1) {
    const value = normalizeText(cellToText(worksheet.getRow(row).getCell(col))).toUpperCase();
    if (value === "P" || value === "E") return value;
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
  return /^<?\s*\d+(?:[.,]\d+)?\s*$/.test(value.trim());
}

function parseMm(value: null | string): null | number {
  if (!value) return null;
  const normalized = value.replace("<", "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
