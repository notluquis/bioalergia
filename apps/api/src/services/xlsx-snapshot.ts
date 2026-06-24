import { db } from "@finanzas/db";
import * as xlsx from "xlsx";

// Shared OneDrive XLSX snapshot layer. This module OWNS the feature-agnostic
// extraction (buffer → structured first-sheet cell grid) and the persist/read/
// reconstruct helpers over the shared clinical_xlsx_files row, so any feature
// (tests cutáneos, fichas clínicas) re-parses from DB instead of re-downloading
// from OneDrive. The skin-test snapshot service re-exports these under its
// legacy names for back-compat.

// Bumped from 2026-04-27.1: migrated from ExcelJS to SheetJS 0.20.3 (fixes
// merged-cell richText bugs). Keep this value stable — existing snapshots are
// keyed by it.
export const XLSX_SNAPSHOT_EXTRACTOR_VERSION = "2026-05-02.1";

export type XlsxSnapshotCellType =
  | "blank"
  | "boolean"
  | "date"
  | "error"
  | "formula"
  | "number"
  | "richText"
  | "string";

export type XlsxSnapshotRawValue =
  | { kind: "blank"; value: null }
  | { kind: "boolean"; value: boolean }
  | { kind: "date"; value: string }
  | { kind: "error"; value: string }
  | { kind: "formula"; formula: string; result: XlsxSnapshotRawValue }
  | { kind: "hyperlink"; hyperlink: string; text: string }
  | { kind: "number"; value: number }
  | { kind: "richText"; value: string }
  | { kind: "string"; value: string };

interface XlsxSnapshotCellRef {
  a1: string;
  c: number;
  r: number;
  text: string;
}

export interface XlsxSnapshotCell extends XlsxSnapshotCellRef {
  formula?: string;
  note?: string;
  raw: XlsxSnapshotRawValue;
  result?: XlsxSnapshotRawValue;
  style?: {
    alignment?: { horizontal?: string; vertical?: string };
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
  type: XlsxSnapshotCellType;
}

export interface XlsxSnapshot {
  sheet: {
    cells: XlsxSnapshotCell[];
    merges: Array<{ bottom: number; left: number; range: string; right: number; top: number }>;
    name: string;
  };
  version: 1;
}

export async function extractXlsxSnapshot(buffer: Buffer): Promise<XlsxSnapshot> {
  const wb = xlsx.read(buffer, {
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

  const range = xlsx.utils.decode_range(ws["!ref"]);
  const cells: XlsxSnapshotCell[] = [];

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = xlsx.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr] as xlsx.CellObject | undefined;
      if (!cell || cell.t === "z") continue;

      try {
        const text = getCellText(cell);
        if (!text.trim()) continue;

        cells.push({
          a1: addr,
          c: C + 1,
          r: R + 1,
          text,
          type: getCellType(cell),
          raw: serializeCellValue(cell),
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
    range: `${xlsx.utils.encode_cell(m.s)}:${xlsx.utils.encode_cell(m.e)}`,
    right: m.e.c + 1,
    top: m.s.r + 1,
  }));

  return { sheet: { cells, merges, name: sheetName }, version: 1 };
}

function getCellType(cell: xlsx.CellObject): XlsxSnapshotCellType {
  if (cell.f) return "formula";
  switch (cell.t) {
    case "n":
      return "number";
    case "s":
      return "string";
    case "b":
      return "boolean";
    case "e":
      return "error";
    case "d":
      return "date";
    default:
      return "blank";
  }
}

function getCellText(cell: xlsx.CellObject): string {
  if (cell.t === "d") {
    const date = cell.v as Date;
    return isNaN(date.getTime()) ? "Invalid Date" : date.toISOString().slice(0, 10);
  }
  if (cell.w != null) return cell.w;
  if (cell.v == null) return "";
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  return String(cell.v);
}

function serializeCellValue(cell: xlsx.CellObject): XlsxSnapshotRawValue {
  if (cell.f) return { kind: "formula", formula: cell.f, result: serializeScalar(cell) };
  return serializeScalar(cell);
}

function serializeScalar(cell: xlsx.CellObject): XlsxSnapshotRawValue {
  switch (cell.t) {
    case "n":
      return { kind: "number", value: cell.v as number };
    case "s":
      return { kind: "string", value: cell.w ?? String(cell.v ?? "") };
    case "b":
      return { kind: "boolean", value: cell.v as boolean };
    case "e":
      return { kind: "error", value: cell.w ?? String(cell.v ?? "") };
    case "d": {
      const date = cell.v as Date;
      return { kind: "date", value: isNaN(date.getTime()) ? "Invalid Date" : date.toISOString() };
    }
    default:
      return { kind: "blank", value: null };
  }
}

function getCellNote(cell: xlsx.CellObject): string | undefined {
  const comments = cell.c;
  if (!comments?.length) return undefined;
  const text = comments.map((c) => c.t ?? "").join("\n");
  return text || undefined;
}

// Reconstruct the exact row grid a parser sees from a buffer. Rather than hand-
// build the matrix (which drifts from SheetJS's blank-row/range handling), we
// rebuild a worksheet from the snapshot's A1 cells as plain strings and run the
// SAME sheet_to_json call rowsFromBuffer uses.
//
// Verified against real fichas: all clinically-meaningful fields (name, date,
// diagnosis, history, exam, indications, anthropometrics) + confidence + the
// dedup resultHash come out identical to a buffer parse. The only drift is the
// debug-only rawHeader "L{row}" keys, whose numbering can shift by one when the
// snapshot's blank-cell skipping differs from SheetJS on a leading blank row —
// immaterial (rawHeader isn't shown or hashed).
export function snapshotToRows(snapshot: XlsxSnapshot): string[][] {
  const cells = snapshot.sheet.cells;
  if (cells.length === 0) return [];
  const sheet: xlsx.WorkSheet = {};
  let maxR = 0;
  let maxC = 0;
  for (const cell of cells) {
    // Anchor at the captured visible text as a string cell; sheet_to_json
    // raw:false then yields that same text, matching the original parse.
    sheet[cell.a1] = { t: "s", v: cell.text ?? "" };
    if (cell.r - 1 > maxR) maxR = cell.r - 1;
    if (cell.c - 1 > maxC) maxC = cell.c - 1;
  }
  sheet["!ref"] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  const json = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: false,
  });
  return json.map((row) => (row as unknown[]).map((c) => (c == null ? "" : String(c).trim())));
}

// Reconstruct a SheetJS worksheet from the snapshot for parsers that read the
// worksheet directly (by A1 address) rather than row arrays. Each captured cell
// becomes a string cell whose `w` (formatted text) AND `v` equal the snapshot's
// visible text, so a parser's getCellText(cell) — which prefers `cell.w` — yields
// the exact same text it saw from the original buffer. The skin-test parser only
// reads cells through getCellText + `!ref`; it never inspects merges or numeric
// types, so a string-cell grid reproduces its output faithfully.
export function snapshotToWorksheet(snapshot: XlsxSnapshot): xlsx.WorkSheet {
  const cells = snapshot.sheet.cells;
  const sheet: xlsx.WorkSheet = {};
  if (cells.length === 0) {
    sheet["!ref"] = "A1:A1";
    return sheet;
  }
  let maxR = 0;
  let maxC = 0;
  for (const cell of cells) {
    const text = cell.text ?? "";
    sheet[cell.a1] = { t: "s", v: text, w: text };
    if (cell.r - 1 > maxR) maxR = cell.r - 1;
    if (cell.c - 1 > maxC) maxC = cell.c - 1;
  }
  sheet["!ref"] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  return sheet;
}

export type XlsxSnapshotRecord = {
  status: string | null;
  snapshot: XlsxSnapshot | null;
  etag: string | null;
  ctag: string | null;
};

// Read the stored snapshot for a scanned library file (by clinical_xlsx_files.id).
export async function readXlsxFileSnapshot(xlsxFileId: string): Promise<XlsxSnapshotRecord | null> {
  const row = await db.clinicalXlsxFile.findUnique({
    where: { id: xlsxFileId },
    select: {
      snapshotStatus: true,
      snapshotJson: true,
      snapshotEtag: true,
      snapshotCtag: true,
    },
  });
  if (!row) return null;
  return {
    status: row.snapshotStatus,
    snapshot: row.snapshotJson as XlsxSnapshot | null,
    etag: row.snapshotEtag,
    ctag: row.snapshotCtag,
  };
}

// Locate the shared library row for an OneDrive item (the snapshot host).
// The original SQL used `IS NOT DISTINCT FROM` so a null accountId/driveId
// matches rows where that column is also null. ZenStack reproduces this by
// branching: `{ field: null }` → `IS NULL`, `{ field: value }` → `= value`.
export async function findXlsxFileByOneDriveItem(
  accountId: string | null,
  driveId: string | null,
  itemId: string
): Promise<{ id: string; etag: string | null; ctag: string | null } | null> {
  const row = await db.clinicalXlsxFile.findFirst({
    where: {
      oneDriveAccountId: accountId,
      oneDriveDriveId: driveId,
      oneDriveItemId: itemId,
    },
    select: { id: true, oneDriveETag: true, oneDriveCTag: true },
  });
  return row ? { id: row.id, etag: row.oneDriveETag, ctag: row.oneDriveCTag } : null;
}

// Extract + store the snapshot on the library row. Idempotent (overwrites).
export async function persistXlsxFileSnapshot(
  xlsxFileId: string,
  buffer: Buffer,
  tags: { etag?: string | null; ctag?: string | null }
): Promise<{ cellCount: number; snapshot: XlsxSnapshot }> {
  const snapshot = await extractXlsxSnapshot(buffer);
  const cellCount = snapshot.sheet.cells.length;
  await db.clinicalXlsxFile.update({
    where: { id: xlsxFileId },
    data: {
      snapshotStatus: "ARCHIVED",
      // ZenStack serializes Json values; pass the object, not JSON.stringify.
      snapshotJson: snapshot as never,
      snapshotEtag: tags.etag ?? null,
      snapshotCtag: tags.ctag ?? null,
      snapshotExtractorVersion: XLSX_SNAPSHOT_EXTRACTOR_VERSION,
      snapshotCellCount: cellCount,
      snapshotArchivedAt: new Date(),
      snapshotError: null,
      // updatedAt is @updatedAt — ZenStack stamps it automatically.
    },
  });
  return { cellCount, snapshot };
}

// A snapshot is usable when ARCHIVED and its OneDrive tags still match the
// library row's last-synced tags (else the file changed → STALE → re-fetch).
export function isSnapshotFresh(
  record: XlsxSnapshotRecord,
  current: { etag: string | null; ctag: string | null }
): boolean {
  if (record.status !== "ARCHIVED" || !record.snapshot) return false;
  if (record.etag != null && current.etag != null) return record.etag === current.etag;
  if (record.ctag != null && current.ctag != null) return record.ctag === current.ctag;
  // No tags to compare on either side — accept the snapshot (scan keeps the row fresh).
  return true;
}
