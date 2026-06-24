-- Job Radar — banca/seguros (Trabajando, validadas en vivo 2026-06-24).
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TRABAJANDO', 'pentavida',  'Penta Vida',  true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'bciseguros', 'Bci Seguros', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
