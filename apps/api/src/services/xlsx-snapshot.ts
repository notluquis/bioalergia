import { kysely } from "@finanzas/db";
import { sql } from "kysely";
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

// Reconstruct the dense row/col grid a parser expects, matching
// xlsx.sheet_to_json(sheet, { header: 1, raw: false, defval: null,
// blankrows: false }): 1-indexed cells placed at [r-1][c-1] as trimmed text,
// then fully-blank rows dropped.
export function snapshotToRows(snapshot: XlsxSnapshot): string[][] {
  const cells = snapshot.sheet.cells;
  if (cells.length === 0) return [];
  let maxR = 0;
  let maxC = 0;
  for (const cell of cells) {
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c > maxC) maxC = cell.c;
  }
  const grid: string[][] = Array.from({ length: maxR }, () => Array.from({ length: maxC }, () => ""));
  for (const cell of cells) {
    grid[cell.r - 1][cell.c - 1] = (cell.text ?? "").trim();
  }
  return grid.filter((row) => row.some((c) => c !== ""));
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
