-- Job Radar — construcción + comida (validadas en vivo 2026-06-24).
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TRABAJANDO',   'ebco',      'EBCO (Constructora)',      true),
  (gen_random_uuid()::text, 'TRABAJANDO',   'ingevec',   'Ingevec (Constructora)',   true),
  (gen_random_uuid()::text, 'COMPUTRABAJO', 'mcdonalds', 'McDonald''s Chile',         true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
