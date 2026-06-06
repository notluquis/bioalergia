import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import xlsx from "xlsx";
import {
  extractSkinTestWorkbookSnapshot,
  SKIN_TEST_WORKBOOK_SNAPSHOT_VERSION,
  type SkinTestWorkbookSnapshot,
} from "./clinical-skin-test-workbook-snapshots.ts";

// Shared OneDrive XLSX snapshot layer. The first sheet of each scanned xlsx is
// extracted to a structured cell grid and stored on the shared clinical_xlsx_files
// row, so any feature (tests cutáneos, fichas clínicas) re-parses from DB instead
// of re-downloading from OneDrive.
//
// The extraction (buffer → cells) is feature-agnostic; for now it is re-exported
// from the skin-test snapshot service where it currently lives (moved into this
// module in a later phase). The persist/read/reconstruct helpers below operate on
// the shared library table.

export type XlsxSnapshot = SkinTestWorkbookSnapshot;
export const XLSX_SNAPSHOT_EXTRACTOR_VERSION = SKIN_TEST_WORKBOOK_SNAPSHOT_VERSION;

export async function extractXlsxSnapshot(buffer: Buffer): Promise<XlsxSnapshot> {
  return extractSkinTestWorkbookSnapshot(buffer);
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

export type XlsxSnapshotRecord = {
  status: string | null;
  snapshot: XlsxSnapshot | null;
  etag: string | null;
  ctag: string | null;
};

// Read the stored snapshot for a scanned library file (by clinical_xlsx_files.id).
export async function readXlsxFileSnapshot(xlsxFileId: string): Promise<XlsxSnapshotRecord | null> {
  const r = await sql<{
    snapshot_status: string | null;
    snapshot_json: XlsxSnapshot | null;
    snapshot_etag: string | null;
    snapshot_ctag: string | null;
  }>`
    SELECT snapshot_status, snapshot_json, snapshot_etag, snapshot_ctag
    FROM clinical_xlsx_files WHERE id = ${xlsxFileId}
  `.execute(kysely);
  const row = r.rows[0];
  if (!row) return null;
  return {
    status: row.snapshot_status,
    snapshot: row.snapshot_json,
    etag: row.snapshot_etag,
    ctag: row.snapshot_ctag,
  };
}

// Locate the shared library row for an OneDrive item (the snapshot host).
export async function findXlsxFileByOneDriveItem(
  accountId: string | null,
  driveId: string | null,
  itemId: string
): Promise<{ id: string; etag: string | null; ctag: string | null } | null> {
  const r = await sql<{ id: string; onedrive_etag: string | null; onedrive_ctag: string | null }>`
    SELECT id, onedrive_etag, onedrive_ctag FROM clinical_xlsx_files
    WHERE onedrive_account_id IS NOT DISTINCT FROM ${accountId}
      AND onedrive_drive_id IS NOT DISTINCT FROM ${driveId}
      AND onedrive_item_id = ${itemId}
    LIMIT 1
  `.execute(kysely);
  const row = r.rows[0];
  return row ? { id: row.id, etag: row.onedrive_etag, ctag: row.onedrive_ctag } : null;
}

// Extract + store the snapshot on the library row. Idempotent (overwrites).
export async function persistXlsxFileSnapshot(
  xlsxFileId: string,
  buffer: Buffer,
  tags: { etag?: string | null; ctag?: string | null }
): Promise<{ cellCount: number; snapshot: XlsxSnapshot }> {
  const snapshot = await extractXlsxSnapshot(buffer);
  const cellCount = snapshot.sheet.cells.length;
  await sql`
    UPDATE clinical_xlsx_files SET
      snapshot_status = 'ARCHIVED',
      snapshot_json = ${JSON.stringify(snapshot)}::jsonb,
      snapshot_etag = ${tags.etag ?? null},
      snapshot_ctag = ${tags.ctag ?? null},
      snapshot_extractor_version = ${XLSX_SNAPSHOT_EXTRACTOR_VERSION},
      snapshot_cell_count = ${cellCount},
      snapshot_archived_at = now(),
      snapshot_error = null,
      updated_at = now()
    WHERE id = ${xlsxFileId}
  `.execute(kysely);
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
