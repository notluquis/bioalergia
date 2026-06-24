-- Job Radar — fuentes Eightfold + Minisite (validadas en vivo 2026-06-23).
--   · MercadoLibre/MercadoPago → Eightfold; identifier "tenant:domain:location"
--     (mismo tenant cubre marketplace + fintech MercadoPago). 89 ofertas Chile.
--   · SQM → Minisite en su dominio propio trabajaensqm.com. 27 ofertas.
-- Ambos traen la oferta COMPLETA (descripción incluida); sin filtro de keyword.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'EIGHTFOLD', 'mercadolibre:mercadolibre.com:chile', 'MercadoLibre / MercadoPago (Eightfold)', true),
  (gen_random_uuid()::text, 'MINISITE',  'trabajaensqm.com',                   'SQM (sitio propio)',                    true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
