-- Add clinical series support for clustered care journeys
-- Covers patch/skin tests and subcutaneous treatment schemes

DO $$ BEGIN
  CREATE TYPE "ClinicalSeriesKind" AS ENUM ('PATCH_TEST', 'SKIN_TEST', 'SUBCUTANEOUS_TREATMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClinicalSeriesStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClinicalSeriesStageKind" AS ENUM ('INSTALLATION', 'READING', 'DOSE', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "clinical_series" (
  "id" SERIAL PRIMARY KEY,
  "kind" "ClinicalSeriesKind" NOT NULL,
  "status" "ClinicalSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
  "display_name" TEXT,
  "patient_name" TEXT,
  "patient_rut" TEXT,
  "expected_sessions" INTEGER,
  "notes" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "clinical_series_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "series_stage_kind" "ClinicalSeriesStageKind",
  ADD COLUMN IF NOT EXISTS "series_stage_number" INTEGER,
  ADD COLUMN IF NOT EXISTS "series_stage_label" TEXT;

CREATE INDEX IF NOT EXISTS "clinical_series_kind_status_idx"
  ON "clinical_series"("kind", "status");

CREATE INDEX IF NOT EXISTS "clinical_series_patient_rut_idx"
  ON "clinical_series"("patient_rut");

CREATE INDEX IF NOT EXISTS "events_clinical_series_id_idx"
  ON "events"("clinical_series_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_clinical_series_id_fkey'
  ) THEN
    ALTER TABLE "events"
      ADD CONSTRAINT "events_clinical_series_id_fkey"
      FOREIGN KEY ("clinical_series_id") REFERENCES "clinical_series"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
