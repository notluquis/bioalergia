import { createId } from "@paralleldrive/cuid2";
import { createHash } from "node:crypto";
import { db } from "@finanzas/db";
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

  const sizeBytes = sourceSizeBytes ?? buffer.byteLength;
  const sheetName = snapshot.sheet.name;
  const cellCount = snapshot.sheet.cells.length;
  const mergeCount = snapshot.sheet.merges.length;

  // Upsert on the (sha256, extractor_version) unique. ON CONFLICT DO UPDATE
  // never touches sha256 (the conflict key) nor created_at; updated_at is
  // @updatedAt so the ORM stamps it automatically on both create and update.
  const fileRecord = await db.clinicalSkinTestWorkbookFile.upsert({
    where: {
      sha256_extractorVersion: { sha256, extractorVersion: XLSX_SNAPSHOT_EXTRACTOR_VERSION },
    },
    create: {
      id: fileId,
      extractorVersion: XLSX_SNAPSHOT_EXTRACTOR_VERSION,
      sha256,
      sizeBytes,
      sheetName,
      cellCount,
      mergeCount,
      textHash,
      snapshotJson: snapshot as never,
    },
    update: {
      extractorVersion: XLSX_SNAPSHOT_EXTRACTOR_VERSION,
      sizeBytes,
      sheetName,
      cellCount,
      mergeCount,
      textHash,
      snapshotJson: snapshot as never,
    },
    select: { id: true },
  });
  const workbookFileId = fileRecord?.id ?? fileId;

  // Upsert on the source_import_id unique. error is reset to null on update;
  // status forced to ARCHIVED (matches 'ARCHIVED'::enum cast).
  await db.clinicalSkinTestWorkbookSnapshot.upsert({
    where: { sourceImportId: importId },
    create: {
      id: snapshotId,
      sourceImportId: importId,
      workbookFileId,
      sourceETag: sourceETag ?? null,
      sourceCTag: sourceCTag ?? null,
      status: "ARCHIVED",
      error: null,
    },
    update: {
      workbookFileId,
      sourceETag: sourceETag ?? null,
      sourceCTag: sourceCTag ?? null,
      status: "ARCHIVED",
      error: null,
    },
  });

  await db.clinicalSkinTestImport.update({
    where: { id: importId },
    data: {
      workbookSnapshotStatus: "ARCHIVED",
      workbookSnapshotError: null,
      workbookSnapshotArchivedAt: new Date(),
    },
  });

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
