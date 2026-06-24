-- Job Radar — fuentes Computrabajo. Empresas grandes que NO publican en un ATS
-- scrapeable propio (usan portal propio/SuccessFactors no parseable) pero SÍ
-- publican en Computrabajo. Cada `identifier` VALIDADO en vivo con el adapter
-- (conteo de ofertas al 2026-06-23). Formatos de identifier soportados:
--   canónico  "ofertas-de-trabajo-de-{slug}-{HASH16}"
--   short     "{nombre-corto}"   (resuelve a /{nombre}/empleos)
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'COMPUTRABAJO', 'nestle',                                          'Nestlé Chile (Computrabajo)',   true),
  (gen_random_uuid()::text, 'COMPUTRABAJO', 'turbus',                                          'Turbus (Computrabajo)',         true),
  (gen_random_uuid()::text, 'COMPUTRABAJO', 'ofertas-de-trabajo-de-agrosuper-sa-ADDC0B1F7D4B1150', 'Agrosuper (Computrabajo)',  true),
  (gen_random_uuid()::text, 'COMPUTRABAJO', 'ofertas-de-trabajo-de-sodexo-chile-1cd2daff22bdf3d8', 'Sodexo Chile (Computrabajo)', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
