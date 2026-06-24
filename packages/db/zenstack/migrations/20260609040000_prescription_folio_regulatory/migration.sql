-- Receta médica: folio + datos regulatorios. 100% aditivo + idempotente.
-- Secuencia para el correlativo interno del folio (auditoría).
CREATE SEQUENCE IF NOT EXISTS "medical_prescription_folio_seq";

ALTER TABLE "medical_prescriptions"
  ADD COLUMN IF NOT EXISTS "folio" TEXT,
  ADD COLUMN IF NOT EXISTS "folio_seq" INTEGER,
  ADD COLUMN IF NOT EXISTS "prescription_type" TEXT NOT NULL DEFAULT 'SIMPLE',
  ADD COLUMN IF NOT EXISTS "doctor_license" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ISSUED';

CREATE UNIQUE INDEX IF NOT EXISTS "medical_prescriptions_folio_key"
  ON "medical_prescriptions"("folio");
