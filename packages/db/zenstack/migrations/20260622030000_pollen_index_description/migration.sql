-- P3 polen: agrega el texto humano del índice diario (Google `indexInfo.indexDescription`).
-- Aditivo + idempotente. Seguro de re-aplicar y de aplicar aunque la base
-- 20260622000000_pollen_forecasts ya tenga la tabla creada.

ALTER TABLE "pollen_forecasts" ADD COLUMN IF NOT EXISTS "index_description" TEXT;
