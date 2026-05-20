-- Doctoralia manda patient_reference_id null en algunos appointments
-- (sin referencia de paciente) → el create fallaba (columna NOT NULL).
-- Hacerla nullable. Idempotente.

ALTER TABLE "public"."doctoralia_calendar_appointments"
  ALTER COLUMN "patient_reference_id" DROP NOT NULL;
