-- Seed Pandapé CL (verificado). Va DESPUÉS del enum add.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'PANDAPE', 'ripleychile',           'Ripley',       true),
  (gen_random_uuid()::text, 'PANDAPE', 'red-salud-uc-christus', 'UC Christus',  true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
