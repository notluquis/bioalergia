-- Patient identity hub (pulpo): Doctoralia identity key + guardian link +
-- appointment→patient FK. All additive/nullable — safe on the drifted prod DB.
-- Multi-schema datasource: force search_path so unqualified refs resolve to public.
SET search_path TO public, personal;

-- Person: stable Doctoralia identity key (dedup on re-sync).
ALTER TABLE "people"
  ADD COLUMN IF NOT EXISTS "doctoralia_external_id" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "people_doctoralia_external_id_key"
  ON "people" ("doctoralia_external_id");

-- Patient: guardian / payer (titular ≠ paciente).
ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "guardian_person_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "guardian_relationship" TEXT;
CREATE INDEX IF NOT EXISTS "patients_guardian_person_id_idx"
  ON "patients" ("guardian_person_id");
DO $$ BEGIN
  ALTER TABLE "patients"
    ADD CONSTRAINT "patients_guardian_person_id_fkey"
    FOREIGN KEY ("guardian_person_id") REFERENCES "people" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Doctoralia appointment → internal Patient link (resolved by the feeder).
ALTER TABLE "doctoralia_calendar_appointments"
  ADD COLUMN IF NOT EXISTS "patient_id" INTEGER;
CREATE INDEX IF NOT EXISTS "doctoralia_calendar_appointments_patient_id_idx"
  ON "doctoralia_calendar_appointments" ("patient_id");
DO $$ BEGIN
  ALTER TABLE "doctoralia_calendar_appointments"
    ADD CONSTRAINT "doctoralia_calendar_appointments_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
