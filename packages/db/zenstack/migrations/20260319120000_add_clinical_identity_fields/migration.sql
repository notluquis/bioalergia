-- Multi-schema datasource (public, personal): force search_path so unqualified
-- table refs below resolve to the public schema in the shadow DB rebuild.
-- Production data unaffected — this migration already ran in prod against the
-- correct (public) tables when the original unqualified version was applied.
SET search_path TO public, personal;

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
