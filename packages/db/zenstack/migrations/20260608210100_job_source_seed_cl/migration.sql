-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Job Radar — seed de fuentes CL nuevas (SuccessFactors RMK / Trabajando.com / muevete)
-- Generado a mano — aplicar con: pnpm -F @finanzas/db migrate:deploy
-- 100% aditivo + idempotente (ON CONFLICT DO NOTHING). Va DESPUÉS de la migración
-- que agrega los enum values (no usar el valor en la misma txn que lo crea).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  -- SuccessFactors RMK (Jobs2Web): identifier = host (+ path multi-tenant)
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'trabajos.achs.cl',          'ACHS',            true),
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'empleos.codelco.cl',        'Codelco',         true),
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'jobs.arauco.com',           'Arauco',          true),
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'www.nuevotalento.cl/Essbio','Essbio',          true),
  -- Trabajando.com: identifier = slug del subdominio
  (gen_random_uuid()::text, 'TRABAJANDO',     'cge',                       'CGE',             true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'hospitalclinicosur',        'Hospital Clínico del Sur', true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'cmpc',                      'CMPC',            true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'bancoestado',               'BancoEstado',     true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'bancodechile',              'Banco de Chile',  true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'cencosud',                  'Cencosud',        true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'aguasandinas',              'Aguas Andinas',   true),
  -- muevete (Falabella): fuente única, agrega todo el grupo. identifier nominal.
  (gen_random_uuid()::text, 'MUEVETE',        'falabella',                 'Falabella (grupo)', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
