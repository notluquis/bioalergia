ALTER TABLE "clinical_xlsx_files"
  ADD COLUMN "onedrive_source_key" TEXT,
  ADD COLUMN "onedrive_source_drive_id" TEXT,
  ADD COLUMN "onedrive_source_item_id" TEXT,
  ADD COLUMN "onedrive_sharepoint_unique_id" TEXT;

ALTER TABLE "clinical_skin_test_imports"
  ADD COLUMN "onedrive_source_key" TEXT,
  ADD COLUMN "onedrive_source_drive_id" TEXT,
  ADD COLUMN "onedrive_source_item_id" TEXT,
  ADD COLUMN "onedrive_sharepoint_unique_id" TEXT;

CREATE INDEX "clinical_xlsx_files_onedrive_source_key_idx"
  ON "clinical_xlsx_files"("onedrive_source_key");

CREATE INDEX "clinical_skin_test_imports_onedrive_source_key_idx"
  ON "clinical_skin_test_imports"("onedrive_source_key");
