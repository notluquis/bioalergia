import { createId } from "@paralleldrive/cuid2";
import ExcelJS from "exceljs";
import { sql } from "kysely";
import { createHash } from "node:crypto";
import { kysely } from "@finanzas/db";

export const SKIN_TEST_WORKBOOK_SNAPSHOT_VERSION = "2026-04-27.1";

type ExcelWorkbookBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

type SnapshotCellType = "blank" | "boolean" | "date" | "error" | "formula" | "number" | "richText" | "string";
type SnapshotRawValue =
  | { kind: "blank"; value: null }
  | { kind: "boolean"; value: boolean }
  | { kind: "date"; value: string }
  | { kind: "error"; value: string }
  | { kind: "formula"; formula: string; result: SnapshotRawValue }
  | { kind: "hyperlink"; hyperlink: string; text: string }
  | { kind: "number"; value: number }
  | { kind: "richText"; value: string }
  | { kind: "string"; value: string };

interface SnapshotCellRef {
  a1: string;
  c: number;
  r: number;
  text: string;
}

export interface SkinTestWorkbookSnapshotCell extends SnapshotCellRef {
  formula?: string;
  note?: string;
  raw: SnapshotRawValue;
  result?: SnapshotRawValue;
  style?: {
    alignment?: {
      horizontal?: string;
      vertical?: string;
    };
    border?: boolean;
    fillColor?: string;
    font?: {
      bold?: boolean;
      color?: string;
      italic?: boolean;
      name?: string;
      size?: number;
      underline?: boolean;
    };
    numFmt?: string;
  };
  type: SnapshotCellType;
}

export interface SkinTestWorkbookSnapshot {
  sheet: {
    cells: SkinTestWorkbookSnapshotCell[];
    merges: Array<{
      bottom: number;
      left: number;
      range: string;
      right: number;
      top: number;
    }>;
    name: string;
  };
  version: 1;
}

export interface PersistSkinTestWorkbookSnapshotResult {
  cellCount: number;
  mergeCount: number;
  sha256: string;
  sheetName: string;
  snapshot: SkinTestWorkbookSnapshot;
  textHash: string;
  workbookFileId: string;
}

export interface PersistSkinTestWorkbookSnapshotInput {
  buffer: Buffer;
  importId: string;
  sourceCTag?: null | string;
  sourceETag?: null | string;
  sourceSizeBytes?: null | number;
}

export async function extractSkinTestWorkbookSnapshot(
  buffer: ExcelWorkbookBuffer
): Promise<SkinTestWorkbookSnapshot> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("El archivo no tiene hojas para snapshot.");
  }

  const cells: SkinTestWorkbookSnapshotCell[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (isEmptyCell(cell)) return;
      cells.push({
        a1: cell.address,
        c: colNumber,
        note: serializeNote(cell.note),
        r: rowNumber,
        raw: serializeCellValue(cell.value),
        result: serializeFormulaResult(cell.value),
        style: serializeCellStyle(cell),
        text: cell.text ?? "",
        type: getCellType(cell.value),
        ...(getFormula(cell.value) ? { formula: getFormula(cell.value) } : {}),
      });
    });
  });

  return {
    sheet: {
      cells,
      merges: extractMerges(worksheet),
      name: worksheet.name,
    },
    version: 1,
  };
}

export async function persistSkinTestWorkbookSnapshot({
  buffer,
  importId,
  sourceCTag,
  sourceETag,
  sourceSizeBytes,
}: PersistSkinTestWorkbookSnapshotInput): Promise<PersistSkinTestWorkbookSnapshotResult> {
  const snapshot = await extractSkinTestWorkbookSnapshot(buffer as unknown as ExcelWorkbookBuffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const textHash = computeSnapshotTextHash(snapshot);
  const fileId = createId();
  const snapshotId = createId();

  const fileResult = await sql<{ id: string }>`
    INSERT INTO clinical_skin_test_workbook_files (
      id,
      extractor_version,
      sha256,
      size_bytes,
      sheet_name,
      cell_count,
      merge_count,
      text_hash,
      snapshot_json,
      created_at,
      updated_at
    )
    VALUES (
      ${fileId},
      ${SKIN_TEST_WORKBOOK_SNAPSHOT_VERSION},
      ${sha256},
      ${sourceSizeBytes ?? buffer.byteLength},
      ${snapshot.sheet.name},
      ${snapshot.sheet.cells.length},
      ${snapshot.sheet.merges.length},
      ${textHash},
      ${JSON.stringify(snapshot)}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (sha256, extractor_version)
    DO UPDATE SET
      extractor_version = EXCLUDED.extractor_version,
      size_bytes = EXCLUDED.size_bytes,
      sheet_name = EXCLUDED.sheet_name,
      cell_count = EXCLUDED.cell_count,
      merge_count = EXCLUDED.merge_count,
      text_hash = EXCLUDED.text_hash,
      snapshot_json = EXCLUDED.snapshot_json,
      updated_at = now()
    RETURNING id
  `.execute(kysely);
  const workbookFileId = fileResult.rows[0]?.id ?? fileId;

  await sql`
    INSERT INTO clinical_skin_test_workbook_snapshots (
      id,
      source_import_id,
      workbook_file_id,
      source_etag,
      source_ctag,
      status,
      error,
      created_at,
      updated_at
    )
    VALUES (
      ${snapshotId},
      ${importId},
      ${workbookFileId},
      ${sourceETag ?? null},
      ${sourceCTag ?? null},
      'ARCHIVED'::"ClinicalSkinTestWorkbookSnapshotStatus",
      null,
      now(),
      now()
    )
    ON CONFLICT (source_import_id)
    DO UPDATE SET
      workbook_file_id = EXCLUDED.workbook_file_id,
      source_etag = EXCLUDED.source_etag,
      source_ctag = EXCLUDED.source_ctag,
      status = EXCLUDED.status,
      error = null,
      updated_at = now()
  `.execute(kysely);

  await sql`
    UPDATE clinical_skin_test_imports
    SET workbook_snapshot_status = 'ARCHIVED',
        workbook_snapshot_error = null,
        workbook_snapshot_archived_at = now(),
        updated_at = now()
    WHERE id = ${importId}
  `.execute(kysely);

  return {
    cellCount: snapshot.sheet.cells.length,
    mergeCount: snapshot.sheet.merges.length,
    sha256,
    sheetName: snapshot.sheet.name,
    snapshot,
    textHash,
    workbookFileId,
  };
}

function isEmptyCell(cell: ExcelJS.Cell): boolean {
  return cell.value === null || cell.value === undefined || cell.text.trim() === "";
}

function getCellType(value: ExcelJS.CellValue): SnapshotCellType {
  if (value === null || value === undefined) return "blank";
  if (value instanceof Date) return "date";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "object") {
    if ("formula" in value) return "formula";
    if ("error" in value) return "error";
    if ("richText" in value) return "richText";
  }
  return "string";
}

function serializeCellValue(value: ExcelJS.CellValue): SnapshotRawValue {
  if (value === null || value === undefined) return { kind: "blank", value: null };
  if (value instanceof Date) return { kind: "date", value: value.toISOString() };
  if (typeof value === "boolean") return { kind: "boolean", value };
  if (typeof value === "number") return { kind: "number", value };
  if (typeof value === "string") return { kind: "string", value };
  if ("formula" in value) {
    return {
      kind: "formula",
      formula: value.formula ?? "",
      result: serializeCellValue(value.result as ExcelJS.CellValue),
    };
  }
  if ("richText" in value) {
    return { kind: "richText", value: value.richText.map((part) => part.text).join("") };
  }
  if ("hyperlink" in value) {
    return {
      kind: "hyperlink",
      hyperlink: value.hyperlink,
      text: value.text ?? "",
    };
  }
  if ("error" in value) return { kind: "error", value: value.error };
  return { kind: "string", value: JSON.stringify(value) };
}

function serializeFormulaResult(value: ExcelJS.CellValue): SnapshotRawValue | undefined {
  if (!value || typeof value !== "object" || !("formula" in value)) return undefined;
  return serializeCellValue(value.result as ExcelJS.CellValue);
}

function computeSnapshotTextHash(snapshot: SkinTestWorkbookSnapshot): string {
  const visibleText = snapshot.sheet.cells
    .map((cell) => `${cell.a1}:${cell.text}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(visibleText).digest("hex");
}

function getFormula(value: ExcelJS.CellValue): string | undefined {
  if (!value || typeof value !== "object" || !("formula" in value)) return undefined;
  return value.formula;
}

function serializeNote(note: ExcelJS.Cell["note"]): string | undefined {
  if (!note) return undefined;
  if (typeof note === "string") return note;
  if (typeof note === "object" && "texts" in note) {
    return note.texts?.map((entry) => entry.text).join("") || undefined;
  }
  return String(note);
}

function serializeCellStyle(cell: ExcelJS.Cell): SkinTestWorkbookSnapshotCell["style"] | undefined {
  const font = cell.font;
  const alignment = cell.alignment;
  const fill = cell.fill;
  const border = cell.border;
  const style: NonNullable<SkinTestWorkbookSnapshotCell["style"]> = {};

  if (font) {
    style.font = {
      ...(font.bold ? { bold: true } : {}),
      ...(font.color?.argb ? { color: font.color.argb } : {}),
      ...(font.italic ? { italic: true } : {}),
      ...(font.name ? { name: font.name } : {}),
      ...(font.size ? { size: font.size } : {}),
      ...(font.underline ? { underline: true } : {}),
    };
  }
  if (alignment) {
    style.alignment = {
      ...(alignment.horizontal ? { horizontal: alignment.horizontal } : {}),
      ...(alignment.vertical ? { vertical: alignment.vertical } : {}),
    };
  }
  if (cell.numFmt) style.numFmt = cell.numFmt;
  if (fill && "fgColor" in fill && fill.fgColor?.argb) style.fillColor = fill.fgColor.argb;
  if (border && Object.values(border).some(Boolean)) style.border = true;

  if (
    !style.alignment?.horizontal &&
    !style.alignment?.vertical &&
    !style.border &&
    !style.fillColor &&
    !style.font?.bold &&
    !style.font?.color &&
    !style.font?.italic &&
    !style.font?.name &&
    !style.font?.size &&
    !style.font?.underline &&
    !style.numFmt
  ) {
    return undefined;
  }
  return style;
}

function extractMerges(worksheet: ExcelJS.Worksheet): SkinTestWorkbookSnapshot["sheet"]["merges"] {
  const merges = (worksheet.model as { merges?: string[] }).merges ?? [];
  return merges.map((range) => {
    const decoded = decodeRange(range);
    return { range, ...decoded };
  });
}

function decodeRange(range: string): { bottom: number; left: number; right: number; top: number } {
  const [start, end = start] = range.split(":");
  const from = decodeAddress(start ?? "A1");
  const to = decodeAddress(end ?? start ?? "A1");
  return {
    bottom: Math.max(from.row, to.row),
    left: Math.min(from.col, to.col),
    right: Math.max(from.col, to.col),
    top: Math.min(from.row, to.row),
  };
}

function decodeAddress(address: string): { col: number; row: number } {
  const match = address.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return { col: 1, row: 1 };
  const letters = match[1]?.toUpperCase() ?? "A";
  const row = Number(match[2] ?? 1);
  let col = 0;
  for (const letter of letters) {
    col = col * 26 + letter.charCodeAt(0) - 64;
  }
  return { col, row };
}
