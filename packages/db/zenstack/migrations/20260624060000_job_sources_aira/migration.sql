-- Job Radar — feeds AIRAVIRTUAL públicos (GCS) que los agentes creían gated por
-- login: AFP Capital, Mantos Copper, Sierra Gorda, SURA. Validadas en vivo 2026-06-24.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'afp_capital',   'AFP Capital',   true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'mantos_copper', 'Mantos Copper', true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'sierra_gorda',  'Sierra Gorda SCM', true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'sura',          'SURA Chile',    true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
