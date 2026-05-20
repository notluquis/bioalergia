-- Essbio granularity: id_servicio para /getDatos/facturacion + campos historial
-- (fecha corte, periodo, folio, consumo, lectura). Idempotente.

ALTER TABLE "personal"."utility_accounts"
  ADD COLUMN IF NOT EXISTS "external_account_id" TEXT;

ALTER TABLE "personal"."utility_bill_snapshots"
  ADD COLUMN IF NOT EXISTS "period" TEXT,
  ADD COLUMN IF NOT EXISTS "folio" TEXT,
  ADD COLUMN IF NOT EXISTS "consumption" INTEGER,
  ADD COLUMN IF NOT EXISTS "reading" INTEGER;

-- dedupe del historial importado: un snapshot por (cuenta, folio) cuando folio no es null
CREATE UNIQUE INDEX IF NOT EXISTS "utility_bill_snapshots_account_folio_key"
  ON "personal"."utility_bill_snapshots" ("utility_account_id", "folio")
  WHERE "folio" IS NOT NULL;
