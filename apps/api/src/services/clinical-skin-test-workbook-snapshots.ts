import { createId } from "@paralleldrive/cuid2";
import { sql } from "kysely";
import { createHash } from "node:crypto";
import { kysely } from "@finanzas/db";
import {
  extractXlsxSnapshot,
  XLSX_SNAPSHOT_EXTRACTOR_VERSION,
  type XlsxSnapshot,
} from "./xlsx-snapshot.ts";

// Skin-test workbook snapshots. The feature-agnostic extraction (buffer → cell
// grid) now lives in xlsx-snapshot.ts (the shared OneDrive snapshot module);
// this service keeps only the skin-test-specific persistence into
// clinical_skin_test_workbook_files / _snapshots and re-exports the generic
// extraction under its legacy names for back-compat.

export {
  extractXlsxSnapshot as extractSkinTestWorkbookSnapshot,
  XLSX_SNAPSHOT_EXTRACTOR_VERSION as SKIN_TEST_WORKBOOK_SNAPSHOT_VERSION,
} from "./xlsx-snapshot.ts";
export type {
  XlsxSnapshot as SkinTestWorkbookSnapshot,
  XlsxSnapshotCell as SkinTestWorkbookSnapshotCell,
} from "./xlsx-snapshot.ts";

export interface PersistSkinTestWorkbookSnapshotResult {
  cellCount: number;
  mergeCount: number;
  sha256: string;
  sheetName: string;
  snapshot: XlsxSnapshot;
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

export async function persistSkinTestWorkbookSnapshot({
  buffer,
  importId,
  sourceCTag,
  sourceETag,
  sourceSizeBytes,
}: PersistSkinTestWorkbookSnapshotInput): Promise<PersistSkinTestWorkbookSnapshotResult> {
  const snapshot = await extractXlsxSnapshot(buffer);
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
      ${XLSX_SNAPSHOT_EXTRACTOR_VERSION},
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

function computeSnapshotTextHash(snapshot: XlsxSnapshot): string {
  const visibleText = snapshot.sheet.cells
    .map((cell) => `${cell.a1}:${cell.text}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(visibleText).digest("hex");
}
