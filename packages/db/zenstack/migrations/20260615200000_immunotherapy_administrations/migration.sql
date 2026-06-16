-- Carnet de inmunoterapia: registro clínico por dosis administrada (seguridad).
-- Aditivo + idempotente (regla repo: IF NOT EXISTS, aplicar vía psql / migrate deploy).

CREATE TABLE IF NOT EXISTS "immunotherapy_administrations" (
    "id" TEXT NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "clinical_series_id" INTEGER,
    "event_id" INTEGER,
    "administered_at" TIMESTAMP(3) NOT NULL,
    "dose_label" TEXT,
    "dose_ml" DOUBLE PRECISION,
    "vial_description" TEXT,
    "vial_lot" TEXT,
    "vial_expiry" DATE,
    "injection_site" TEXT,
    "observation_minutes" INTEGER NOT NULL DEFAULT 30,
    "observation_completed" BOOLEAN NOT NULL DEFAULT false,
    "had_local_reaction" BOOLEAN NOT NULL DEFAULT false,
    "local_reaction_note" TEXT,
    "systemic_reaction_grade" INTEGER,
    "reaction_note" TEXT,
    "premedication" TEXT,
    "notes" TEXT,
    "administered_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "immunotherapy_administrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "immunotherapy_administrations_patient_id_administered_at_idx"
    ON "immunotherapy_administrations"("patient_id", "administered_at");
CREATE INDEX IF NOT EXISTS "immunotherapy_administrations_clinical_series_id_idx"
    ON "immunotherapy_administrations"("clinical_series_id");

DO $$ BEGIN
  ALTER TABLE "immunotherapy_administrations"
    ADD CONSTRAINT "immunotherapy_administrations_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "immunotherapy_administrations"
    ADD CONSTRAINT "immunotherapy_administrations_clinical_series_id_fkey"
    FOREIGN KEY ("clinical_series_id") REFERENCES "clinical_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
