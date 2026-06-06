-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Job Radar — JobSource (fuentes/empresas como filas, no CSV)
-- Generado a mano (drift en prod) — aplicar con: pnpm -F @finanzas/db migrate:deploy
-- 100% aditivo + idempotente. Incluye seed de las fuentes conocidas.
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateEnum (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'JobSourceKind' AND n.nspname = 'personal'
  ) THEN
    CREATE TYPE "personal"."JobSourceKind" AS ENUM
      ('TEAMTAILOR', 'GREENHOUSE', 'LEVER', 'ASHBY', 'SMARTRECRUITERS', 'WORKDAY', 'AIRAVIRTUAL');
  END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "personal"."job_sources" (
    "id" TEXT NOT NULL,
    "kind" "personal"."JobSourceKind" NOT NULL,
    "identifier" TEXT NOT NULL,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_sources_kind_identifier_key"
  ON "personal"."job_sources"("kind", "identifier");
CREATE INDEX IF NOT EXISTS "job_sources_enabled_idx"
  ON "personal"."job_sources"("enabled");

-- Seed (idempotente). enabled=true = set CL recomendado; false = disponible pero apagado.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TEAMTAILOR', 'tenpo',                     'Tenpo',              true),
  (gen_random_uuid()::text, 'TEAMTAILOR', 'tinet',                     'TINET',              true),
  (gen_random_uuid()::text, 'TEAMTAILOR', 'mindwork',                  'Mindwork',           true),
  (gen_random_uuid()::text, 'TEAMTAILOR', 'global66',                  'Global66',           true),
  (gen_random_uuid()::text, 'TEAMTAILOR', 'qualacompany',             'Quala',              false),
  (gen_random_uuid()::text, 'TEAMTAILOR', 'empleosknaufsouthamerica', 'Knauf South America',false),
  (gen_random_uuid()::text, 'TEAMTAILOR', 'betterfly',                 'Betterfly',          false),
  (gen_random_uuid()::text, 'GREENHOUSE', 'chile',                     'Checkr Chile',       true),
  (gen_random_uuid()::text, 'LEVER',      'fintual',                   'Fintual',            true),
  (gen_random_uuid()::text, 'LEVER',      'xepelin',                   'Xepelin',            true),
  (gen_random_uuid()::text, 'ASHBY',      'toku',                      'Toku',               true),
  (gen_random_uuid()::text, 'ASHBY',      'belvo',                     'Belvo',              false),
  (gen_random_uuid()::text, 'ASHBY',      'addi',                      'Addi',               false),
  (gen_random_uuid()::text, 'ASHBY',      'nubank',                    'Nubank',             false),
  (gen_random_uuid()::text, 'ASHBY',      'mural',                     'Mural',              false),
  (gen_random_uuid()::text, 'SMARTRECRUITERS', 'Sodexo',               'Sodexo',             false),
  (gen_random_uuid()::text, 'WORKDAY',    'citi:wd5:2',                'Citi',               true),
  (gen_random_uuid()::text, 'WORKDAY',    'finning:wd3:External',      'Finning',            false),
  (gen_random_uuid()::text, 'WORKDAY',    'nvidia:wd5:NVIDIAExternalCareerSite', 'NVIDIA',  false),
  (gen_random_uuid()::text, 'WORKDAY',    'walmart:wd5:WalmartExternal','Walmart (global)',  false),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','walmart',                   'Walmart Chile',      true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','cencosud',                  'Cencosud',           true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','cencosud_scotiabank',       'Cencosud Scotiabank',true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','ripley',                    'Ripley',             true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','entel',                     'Entel',              true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','copec',                     'Copec',              true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','sodexo',                    'Sodexo Chile',       true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','komatsu',                   'Komatsu',            true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','finning',                   'Finning Chile',      true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
