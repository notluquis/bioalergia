CREATE TYPE "ClinicalDocumentImportKind" AS ENUM ('CLINICAL_RECORD', 'VISIT_SHEET', 'OTHER');
CREATE TYPE "ClinicalDocumentImportStatus" AS ENUM ('DISCOVERED', 'MATCHED', 'UNMATCHED', 'REJECTED', 'SKIPPED');

CREATE TABLE "clinical_document_imports" (
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
  "document_kind" "ClinicalDocumentImportKind" NOT NULL DEFAULT 'OTHER',
  "status" "ClinicalDocumentImportStatus" NOT NULL DEFAULT 'DISCOVERED',
  "extracted_patient_name" TEXT,
  "clinical_series_id" INTEGER,
  "error" TEXT,
  "issues" JSONB,
  "reviewed_by" INTEGER,
  "reviewed_at" TIMESTAMPTZ(3),
  "review_notes" TEXT,
  "imported_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_document_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clinical_document_imports_status_idx" ON "clinical_document_imports"("status");
CREATE INDEX "clinical_document_imports_document_kind_idx" ON "clinical_document_imports"("document_kind");
CREATE INDEX "clinical_document_imports_modified_at_idx" ON "clinical_document_imports"("modified_at");
CREATE INDEX "clinical_document_imports_onedrive_account_id_idx" ON "clinical_document_imports"("onedrive_account_id");
CREATE INDEX "clinical_document_imports_clinical_series_id_idx" ON "clinical_document_imports"("clinical_series_id");
CREATE UNIQUE INDEX "clinical_document_imports_account_drive_item_key" ON "clinical_document_imports"("onedrive_account_id", "onedrive_drive_id", "onedrive_item_id");

ALTER TABLE "clinical_document_imports"
  ADD CONSTRAINT "clinical_document_imports_onedrive_account_id_fkey"
  FOREIGN KEY ("onedrive_account_id") REFERENCES "onedrive_accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clinical_document_imports"
  ADD CONSTRAINT "clinical_document_imports_clinical_series_id_fkey"
  FOREIGN KEY ("clinical_series_id") REFERENCES "clinical_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
