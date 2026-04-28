CREATE TYPE "ClinicalSkinTestWorkbookSnapshotStatus" AS ENUM ('MISSING', 'ARCHIVED', 'ERROR', 'STALE');

ALTER TABLE "clinical_skin_test_imports"
  ADD COLUMN "workbook_snapshot_status" "ClinicalSkinTestWorkbookSnapshotStatus" NOT NULL DEFAULT 'MISSING',
  ADD COLUMN "workbook_snapshot_error" TEXT,
  ADD COLUMN "workbook_snapshot_archived_at" TIMESTAMPTZ(3);

CREATE TABLE "clinical_skin_test_workbook_files" (
  "id" TEXT NOT NULL,
  "extractor_version" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "size_bytes" INTEGER,
  "sheet_name" TEXT NOT NULL,
  "cell_count" INTEGER NOT NULL DEFAULT 0,
  "merge_count" INTEGER NOT NULL DEFAULT 0,
  "text_hash" TEXT NOT NULL,
  "snapshot_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_skin_test_workbook_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinical_skin_test_workbook_snapshots" (
  "id" TEXT NOT NULL,
  "source_import_id" TEXT NOT NULL,
  "workbook_file_id" TEXT NOT NULL,
  "source_etag" TEXT,
  "source_ctag" TEXT,
  "status" "ClinicalSkinTestWorkbookSnapshotStatus" NOT NULL DEFAULT 'ARCHIVED',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_skin_test_workbook_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinical_skin_test_workbook_files_sha256_extractor_version_key" ON "clinical_skin_test_workbook_files"("sha256", "extractor_version");

CREATE INDEX "clinical_skin_test_workbook_files_sha256_idx" ON "clinical_skin_test_workbook_files"("sha256");

CREATE INDEX "clinical_skin_test_workbook_files_text_hash_idx" ON "clinical_skin_test_workbook_files"("text_hash");

CREATE INDEX "clinical_skin_test_workbook_files_created_at_idx" ON "clinical_skin_test_workbook_files"("created_at");

CREATE UNIQUE INDEX "clinical_skin_test_workbook_snapshots_source_import_id_key" ON "clinical_skin_test_workbook_snapshots"("source_import_id");

CREATE INDEX "clinical_skin_test_workbook_snapshots_workbook_file_id_idx" ON "clinical_skin_test_workbook_snapshots"("workbook_file_id");

CREATE INDEX "clinical_skin_test_workbook_snapshots_status_idx" ON "clinical_skin_test_workbook_snapshots"("status");

CREATE INDEX "clinical_skin_test_workbook_snapshots_created_at_idx" ON "clinical_skin_test_workbook_snapshots"("created_at");

CREATE INDEX "clinical_skin_test_imports_workbook_snapshot_status_idx" ON "clinical_skin_test_imports"("workbook_snapshot_status");

ALTER TABLE "clinical_skin_test_workbook_snapshots" ADD CONSTRAINT "clinical_skin_test_workbook_snapshots_source_import_id_fkey" FOREIGN KEY ("source_import_id") REFERENCES "clinical_skin_test_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clinical_skin_test_workbook_snapshots" ADD CONSTRAINT "clinical_skin_test_workbook_snapshots_workbook_file_id_fkey" FOREIGN KEY ("workbook_file_id") REFERENCES "clinical_skin_test_workbook_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
