ALTER TABLE "events"
  ADD COLUMN "patient_name" TEXT,
  ADD COLUMN "patient_rut" VARCHAR(20),
  ADD COLUMN "beneficiary_name" TEXT,
  ADD COLUMN "beneficiary_rut" VARCHAR(20);

ALTER TABLE "clinical_series"
  ADD COLUMN "beneficiary_name" TEXT,
  ADD COLUMN "beneficiary_rut" VARCHAR(20);

CREATE INDEX "events_patient_rut_idx" ON "events" ("patient_rut");
CREATE INDEX "events_beneficiary_rut_idx" ON "events" ("beneficiary_rut");
CREATE INDEX "clinical_series_beneficiary_rut_idx" ON "clinical_series" ("beneficiary_rut");
