-- Add patient_id FK to clinical_series with backfill from patient_rut → people.rut → patients.id

ALTER TABLE clinical_series
  ADD COLUMN patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL;

-- Backfill: match clinical_series.patient_rut → people.rut → patients.person_id
UPDATE clinical_series cs
SET patient_id = pat.id
FROM people p
JOIN patients pat ON p.id = pat.person_id
WHERE cs.patient_rut = p.rut
  AND cs.patient_rut IS NOT NULL;

CREATE INDEX IF NOT EXISTS clinical_series_patient_id_idx ON clinical_series(patient_id);
