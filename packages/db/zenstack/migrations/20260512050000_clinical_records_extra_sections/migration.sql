-- Clinical records: capture sections the parser was discarding.
--
-- The doctor's ficha clínica xlsx routinely carries ANTECEDENTES
-- (personal + family), MEDICAMENTOS / TRATAMIENTO ACTUAL, ALERGIAS,
-- and OBSERVACIONES / NOTAS DE CONTROL — none of which the original
-- parser materialised. Adding them keeps the row faithful to the
-- source and unblocks downstream FHIR mapping.
--
-- Schema choice follows the IPS-CL Chile FHIR R4 IG + HL7 FHIR R5
-- canonical resources:
--   - antecedents     → Condition + FamilyMemberHistory; JSONB
--                       {personal: string[], family: string[]} for v1,
--                       upgradable to {condition, relationship, onset}
--                       objects later without column reshape.
--   - medications     → MedicationStatement; JSONB string[] for v1
--                       (free-text from the xlsx), upgradable to
--                       {name, dose, frequency, route, since, status}.
--   - known_allergies → AllergyIntolerance; JSONB string[] for v1,
--                       upgradable to {substance, reaction, severity,
--                       criticality}.
--   - observations    → Composition.section.text narrative; plain TEXT.
--
-- GIN indexes on the JSONB columns so future "patients on X drug" /
-- "allergic to Y" queries stay sub-second.
--
-- Refs:
--   - HL7 FHIR R5 Condition / FamilyMemberHistory / MedicationStatement
--     / AllergyIntolerance / Observation
--   - MINSAL EIS FHIR IG (Chile, FHIR R4)
--   - IPS-CL Chile FHIR IG
--   - Ley 21.668 (Chile, 2024) interoperabilidad de la ficha clínica
SET search_path TO public, personal;

ALTER TABLE "clinical_records"
  ADD COLUMN IF NOT EXISTS "antecedents"      JSONB,
  ADD COLUMN IF NOT EXISTS "medications"      JSONB,
  ADD COLUMN IF NOT EXISTS "known_allergies"  JSONB,
  ADD COLUMN IF NOT EXISTS "observations"     TEXT;

CREATE INDEX IF NOT EXISTS clinical_records_medications_gin_idx
  ON clinical_records USING gin (medications jsonb_path_ops);
CREATE INDEX IF NOT EXISTS clinical_records_allergies_gin_idx
  ON clinical_records USING gin (known_allergies jsonb_path_ops);
CREATE INDEX IF NOT EXISTS clinical_records_antecedents_gin_idx
  ON clinical_records USING gin (antecedents jsonb_path_ops);
