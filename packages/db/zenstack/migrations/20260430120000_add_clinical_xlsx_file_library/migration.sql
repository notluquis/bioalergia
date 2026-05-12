CREATE TYPE "ClinicalXlsxFileClassification" AS ENUM ('SKIN_TEST', 'CLINICAL_DOCUMENT', 'OTHER');

CREATE TABLE "clinical_xlsx_files" (
  "id" TEXT NOT NULL,
  "onedrive_account_id" TEXT,
  "onedrive_item_id" TEXT NOT NULL,
  "onedrive_drive_id" TEXT,
  "onedrive_etag" TEXT,
  "onedrive_ctag" TEXT,
  "onedrive_web_url" TEXT,
  "path" TEXT,
  "filename" TEXT NOT NULL,
  "mime_type" TEXT,
  "size" INTEGER,
  "modified_at" TIMESTAMPTZ(3),
  "classification" "ClinicalXlsxFileClassification" NOT NULL DEFAULT 'OTHER',
  "classification_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_xlsx_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clinical_xlsx_files_classification_idx" ON "clinical_xlsx_files"("classification");
CREATE INDEX "clinical_xlsx_files_modified_at_idx" ON "clinical_xlsx_files"("modified_at");
CREATE INDEX "clinical_xlsx_files_onedrive_account_id_idx" ON "clinical_xlsx_files"("onedrive_account_id");
CREATE UNIQUE INDEX "clinical_xlsx_files_account_drive_item_key" ON "clinical_xlsx_files"("onedrive_account_id", "onedrive_drive_id", "onedrive_item_id");

ALTER TABLE "clinical_xlsx_files"
  ADD CONSTRAINT "clinical_xlsx_files_onedrive_account_id_fkey"
  FOREIGN KEY ("onedrive_account_id") REFERENCES "onedrive_accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

