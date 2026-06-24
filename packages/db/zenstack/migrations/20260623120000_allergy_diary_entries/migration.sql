-- eDiary de síntomas (P2, CSMS). Aditivo + idempotente. Una entrada por
-- paciente y día (unique). dSS/dMS/csms computados server-side.

CREATE TABLE IF NOT EXISTS "allergy_diary_entries" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "entry_date" DATE NOT NULL,
    "sneezing" INTEGER NOT NULL DEFAULT 0,
    "rhinorrhea" INTEGER NOT NULL DEFAULT 0,
    "nasal_itching" INTEGER NOT NULL DEFAULT 0,
    "nasal_congestion" INTEGER NOT NULL DEFAULT 0,
    "eye_itching_redness" INTEGER NOT NULL DEFAULT 0,
    "eye_watering" INTEGER NOT NULL DEFAULT 0,
    "med_antihistamine" BOOLEAN NOT NULL DEFAULT false,
    "med_intranasal_steroid" BOOLEAN NOT NULL DEFAULT false,
    "med_oral_steroid" BOOLEAN NOT NULL DEFAULT false,
    "d_ss" DOUBLE PRECISION NOT NULL,
    "d_ms" INTEGER NOT NULL,
    "csms" DOUBLE PRECISION NOT NULL,
    "is_complete" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "entered_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "allergy_diary_entries_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "allergy_diary_entries"
    ADD CONSTRAINT "allergy_diary_entries_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "allergy_diary_entries_patient_id_entry_date_key"
  ON "allergy_diary_entries" ("patient_id", "entry_date");
CREATE INDEX IF NOT EXISTS "allergy_diary_entries_patient_id_entry_date_idx"
  ON "allergy_diary_entries" ("patient_id", "entry_date");
