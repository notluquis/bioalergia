-- Job Radar — Compass Group (catering/casinos, AIRAVIRTUAL público, 186 ofertas).
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'compass_group', 'Compass Group Chile', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
