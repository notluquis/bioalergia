-- Job Radar — canales reales de empresas cuyo portal Trabajando estaba vacío.
-- Investigado dónde publican efectivamente (no en Trabajando):
--   · Banco Itaú → trabajaenitau.cl = SuccessFactors RMK (j2w/Jobs2Web). El
--     adapter SUCCESSFACTORS existente lo lee tal cual (22 ofertas validadas,
--     incluye "Product Owner"/"Business Analyst").
--   · Construmart → publica en Computrabajo (52 ofertas validadas), no en su
--     portal Trabajando.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'trabajaenitau.cl', 'Banco Itaú (SuccessFactors)', true),
  (gen_random_uuid()::text, 'COMPUTRABAJO',   'construmart',      'Construmart (Computrabajo)',  true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
