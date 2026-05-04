import { createId } from "@paralleldrive/cuid2";
import { sql } from "kysely";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { kysely } from "@finanzas/db";

// Bumped from 2026-04-27.1: migrated from ExcelJS to SheetJS 0.20.3 (fixes merged-cell richText bugs)
export const SKIN_TEST_WORKBOOK_SNAPSHOT_VERSION = "2026-05-02.1";

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

export async function extractSkinTestWorkbookSnapshot(buffer: Buffer): Promise<SkinTestWorkbookSnapshot> {
  const wb = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellFormula: true,
    cellHTML: false,
    cellNF: true,
  });

  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no tiene hojas para snapshot.");

  const ws = wb.Sheets[sheetName];
  if (!ws || !ws["!ref"]) {
    return { sheet: { cells: [], merges: [], name: sheetName }, version: 1 };
  }

  const range = XLSX.utils.decode_range(ws["!ref"]);
  const cells: SkinTestWorkbookSnapshotCell[] = [];

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (!cell || cell.t === "z") continue;

      try {
        const text = getCellText(cell);
        if (!text.trim()) continue;

        const type = getCellType(cell);
        const raw = serializeCellValue(cell);

        cells.push({
          a1: addr,
          c: C + 1,
          r: R + 1,
          text,
          type,
          raw,
          ...(cell.f ? { formula: cell.f, result: serializeScalar(cell) } : {}),
          ...(getCellNote(cell) ? { note: getCellNote(cell) } : {}),
        });
      } catch {
        // skip malformed cell, continue with rest of sheet
      }
    }
  }

  const merges = (ws["!merges"] ?? []).map((m) => ({
    bottom: m.e.r + 1,
    left: m.s.c + 1,
    range: `${XLSX.utils.encode_cell(m.s)}:${XLSX.utils.encode_cell(m.e)}`,
    right: m.e.c + 1,
    top: m.s.r + 1,
  }));

  return { sheet: { cells, merges, name: sheetName }, version: 1 };
}

export async function persistSkinTestWorkbookSnapshot({
  buffer,
  importId,
  sourceCTag,
  sourceETag,
  sourceSizeBytes,
}: PersistSkinTestWorkbookSnapshotInput): Promise<PersistSkinTestWorkbookSnapshotResult> {
  const snapshot = await extractSkinTestWorkbookSnapshot(buffer);
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

function getCellType(cell: XLSX.CellObject): SnapshotCellType {
  if (cell.f) return "formula";
  switch (cell.t) {
    case "n": return "number";
    case "s": return "string";
    case "b": return "boolean";
    case "e": return "error";
    case "d": return "date";
    default: return "blank";
  }
}

function getCellText(cell: XLSX.CellObject): string {
  if (cell.t === "d") {
    const d = cell.v as Date;
    return isNaN(d.getTime()) ? "Invalid Date" : d.toISOString().slice(0, 10);
  }
  if (cell.w != null) return cell.w;
  if (cell.v == null) return "";
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  return String(cell.v);
}

function serializeCellValue(cell: XLSX.CellObject): SnapshotRawValue {
  if (cell.f) {
    return { kind: "formula", formula: cell.f, result: serializeScalar(cell) };
  }
  return serializeScalar(cell);
}

function serializeScalar(cell: XLSX.CellObject): SnapshotRawValue {
  switch (cell.t) {
    case "n": return { kind: "number", value: cell.v as number };
    case "s": return { kind: "string", value: cell.w ?? String(cell.v ?? "") };
    case "b": return { kind: "boolean", value: cell.v as boolean };
    case "e": return { kind: "error", value: cell.w ?? String(cell.v ?? "") };
    case "d": {
      const d = cell.v as Date;
      return { kind: "date", value: isNaN(d.getTime()) ? "Invalid Date" : d.toISOString() };
    }
    default: return { kind: "blank", value: null };
  }
}

function getCellNote(cell: XLSX.CellObject): string | undefined {
  const comments = cell.c;
  if (!comments?.length) return undefined;
  const text = comments.map((c) => c.t ?? "").join("\n");
  return text || undefined;
}

function computeSnapshotTextHash(snapshot: SkinTestWorkbookSnapshot): string {
  const visibleText = snapshot.sheet.cells
    .map((cell) => `${cell.a1}:${cell.text}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(visibleText).digest("hex");
}
