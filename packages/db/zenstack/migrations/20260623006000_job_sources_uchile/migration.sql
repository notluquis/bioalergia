-- Job Radar — Universidad de Chile publica en su portal Trabajando de concurso
-- externo (externouchile.trabajando.cl), no en "uchile". 54 ofertas validadas.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TRABAJANDO', 'externouchile', 'Universidad de Chile', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
