-- Job Radar — columna salary en job_postings. Aditivo + idempotente.
-- Aplicar con: pnpm -F @finanzas/db migrate:deploy
ALTER TABLE "personal"."job_postings" ADD COLUMN IF NOT EXISTS "salary" TEXT;
