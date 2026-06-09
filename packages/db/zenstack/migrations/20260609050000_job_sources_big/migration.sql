-- Job Radar — grandes empresas encontradas (Finning/Carozzi/CMPC). Verificadas en vivo.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TEAMTAILOR',  'finning',   'Finning (Teamtailor)', true),
  (gen_random_uuid()::text, 'TRABAJANDO',  'carozzi',   'Carozzi',              true),
  (gen_random_uuid()::text, 'CORNERSTONE', 'cmpc:4',    'CMPC',                 true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
