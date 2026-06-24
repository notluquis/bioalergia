-- Job Radar — retail/consumo/logística (validadas en vivo 2026-06-24).
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TRABAJANDO',   'empresassb',           'Salcobrand / Empresas SB', true),
  (gen_random_uuid()::text, 'TRABAJANDO',   'dhlexpress',           'DHL Express Chile',        true),
  (gen_random_uuid()::text, 'TRABAJANDO',   'parquedelrecuerdo',    'Parque del Recuerdo',      true),
  (gen_random_uuid()::text, 'HIRINGROOM',   'blueexpress',          'Blue Express',             true),
  (gen_random_uuid()::text, 'COMPUTRABAJO', 'tresmontes-lucchetti-sa', 'Tresmontes Lucchetti',  true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
