-- CreateEnum
CREATE TYPE "ClinicalSkinTestImportStatus" AS ENUM ('PENDING_REVIEW', 'IMPORTED', 'REJECTED', 'ERROR', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ClinicalSkinTestControlType" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateTable
CREATE TABLE "clinical_skin_test_imports" (
    "id" TEXT NOT NULL,
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
    "parser_version" TEXT NOT NULL,
    "status" "ClinicalSkinTestImportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "issues" JSONB,
    "parsed_payload" JSONB,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMPTZ(3),
    "review_notes" TEXT,
    "imported_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_skin_test_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_skin_tests" (
    "id" TEXT NOT NULL,
    "clinical_series_id" INTEGER NOT NULL,
    "source_import_id" TEXT NOT NULL,
    "test_date" DATE NOT NULL,
    "patient_name" TEXT,
    "patient_rut" TEXT,
    "patient_email" TEXT,
    "patient_phone" TEXT,
    "age_label" TEXT,
    "panel_title" TEXT,
    "raw_header" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_skin_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_skin_test_results" (
    "id" TEXT NOT NULL,
    "skin_test_id" TEXT NOT NULL,
    "source_import_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "code" TEXT,
    "allergen_name" TEXT NOT NULL,
    "papule_mm" DOUBLE PRECISION,
    "erythema_mm" DOUBLE PRECISION,
    "raw_papule" TEXT,
    "raw_erythema" TEXT,
    "control_type" "ClinicalSkinTestControlType",
    "sort_order" INTEGER NOT NULL,
    "raw_cells" JSONB,

    CONSTRAINT "clinical_skin_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinical_skin_test_imports_onedrive_item_id_key" ON "clinical_skin_test_imports"("onedrive_item_id");

-- CreateIndex
CREATE INDEX "clinical_skin_test_imports_status_idx" ON "clinical_skin_test_imports"("status");

-- CreateIndex
CREATE INDEX "clinical_skin_test_imports_modified_at_idx" ON "clinical_skin_test_imports"("modified_at");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_skin_tests_source_import_id_key" ON "clinical_skin_tests"("source_import_id");

-- CreateIndex
CREATE INDEX "clinical_skin_tests_clinical_series_id_idx" ON "clinical_skin_tests"("clinical_series_id");

-- CreateIndex
CREATE INDEX "clinical_skin_tests_patient_rut_idx" ON "clinical_skin_tests"("patient_rut");

-- CreateIndex
CREATE INDEX "clinical_skin_tests_test_date_idx" ON "clinical_skin_tests"("test_date");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_skin_test_results_source_import_id_section_code_allergen_name_key" ON "clinical_skin_test_results"("source_import_id", "section", "code", "allergen_name");

-- CreateIndex
CREATE INDEX "clinical_skin_test_results_skin_test_id_idx" ON "clinical_skin_test_results"("skin_test_id");

-- AddForeignKey
ALTER TABLE "clinical_skin_tests" ADD CONSTRAINT "clinical_skin_tests_clinical_series_id_fkey" FOREIGN KEY ("clinical_series_id") REFERENCES "clinical_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_skin_tests" ADD CONSTRAINT "clinical_skin_tests_source_import_id_fkey" FOREIGN KEY ("source_import_id") REFERENCES "clinical_skin_test_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_skin_test_results" ADD CONSTRAINT "clinical_skin_test_results_skin_test_id_fkey" FOREIGN KEY ("skin_test_id") REFERENCES "clinical_skin_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_skin_test_results" ADD CONSTRAINT "clinical_skin_test_results_source_import_id_fkey" FOREIGN KEY ("source_import_id") REFERENCES "clinical_skin_test_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
