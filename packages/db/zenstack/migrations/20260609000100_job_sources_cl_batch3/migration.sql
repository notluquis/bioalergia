-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Job Radar — seed fuentes CL (batch 3: ATS nuevos)
-- Aplicar con: pnpm -F @finanzas/db migrate:deploy. Aditivo + idempotente.
-- Todas verificadas en vivo. Va DESPUÉS de la migración que agrega los enum values.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  -- SuccessFactors clásico (host:path:company:locale) — solo tenants CL limpios
  (gen_random_uuid()::text, 'SFCLASSIC', 'career8.successfactors.com:career:lan:es_CL',   'LATAM Airlines',        true),
  (gen_random_uuid()::text, 'SFCLASSIC', 'career8.successfactors.com:career:AMSAP:es_CL', 'Antofagasta Minerals',  true),
  -- Genomawork (slug)
  (gen_random_uuid()::text, 'GENOMAWORK', 'sky-airline', 'SKY Airline', true),
  (gen_random_uuid()::text, 'GENOMAWORK', 'soprole',     'Soprole (Genoma)', true),
  (gen_random_uuid()::text, 'GENOMAWORK', 'queplan',     'Queplan',     true),
  (gen_random_uuid()::text, 'GENOMAWORK', 'comcait',     'Comcait',     true),
  -- HiringRoom (slug subdominio)
  (gen_random_uuid()::text, 'HIRINGROOM', 'cinepolis',       'Cinépolis',              true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'tvn',             'TVN',                    true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'duoc',            'Duoc UC (HiringRoom)',   true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'bicevida',        'Bice Vida',              true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'clinicavespucio', 'Clínica Dávila Vespucio',true),
  -- Buk (slug subdominio)
  (gen_random_uuid()::text, 'BUK', 'hites', 'Hites', true),
  -- Hirefront / myfront (slug subdominio)
  (gen_random_uuid()::text, 'HIREFRONT', 'junji', 'JUNJI', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
