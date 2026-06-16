-- Farmacovigilancia: trazabilidad de notificación de RAM al ISP sobre las dosis
-- administradas (carnet). Aditivo + idempotente.

ALTER TABLE "immunotherapy_administrations"
  ADD COLUMN IF NOT EXISTS "reported_to_isp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "immunotherapy_administrations"
  ADD COLUMN IF NOT EXISTS "isp_reported_at" TIMESTAMP(3);
ALTER TABLE "immunotherapy_administrations"
  ADD COLUMN IF NOT EXISTS "isp_notes" TEXT;

-- Índice parcial: el registro de farmacovigilancia consulta solo reacciones.
CREATE INDEX IF NOT EXISTS "immunotherapy_administrations_adverse_idx"
  ON "immunotherapy_administrations"("administered_at")
  WHERE "systemic_reaction_grade" >= 1 OR "had_local_reaction" = true;
