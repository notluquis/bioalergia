ALTER TABLE "clinical_xlsx_files"
  ADD COLUMN "onedrive_quick_xor_hash" TEXT,
  ADD COLUMN "onedrive_sha1_hash" TEXT,
  ADD COLUMN "onedrive_crc32_hash" TEXT;

ALTER TABLE "clinical_skin_test_imports"
  ADD COLUMN "onedrive_quick_xor_hash" TEXT,
  ADD COLUMN "onedrive_sha1_hash" TEXT,
  ADD COLUMN "onedrive_crc32_hash" TEXT;

ALTER TABLE "clinical_document_imports"
  ADD COLUMN "onedrive_quick_xor_hash" TEXT,
  ADD COLUMN "onedrive_sha1_hash" TEXT,
  ADD COLUMN "onedrive_crc32_hash" TEXT;

CREATE INDEX "clinical_xlsx_files_onedrive_quick_xor_hash_idx"
  ON "clinical_xlsx_files"("onedrive_quick_xor_hash");

CREATE INDEX "clinical_skin_test_imports_onedrive_quick_xor_hash_idx"
  ON "clinical_skin_test_imports"("onedrive_quick_xor_hash");

CREATE INDEX "clinical_document_imports_onedrive_quick_xor_hash_idx"
  ON "clinical_document_imports"("onedrive_quick_xor_hash");
