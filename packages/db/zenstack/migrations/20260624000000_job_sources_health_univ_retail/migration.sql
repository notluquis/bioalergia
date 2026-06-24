-- Job Radar — salud/universidades/retail/servicios (Trabajando, validadas en vivo 2026-06-24).
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TRABAJANDO', 'meds',         'MEDS (Clínica Deportiva)',           true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'falp',         'Fundación Arturo López Pérez (FALP)', true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'clinicabiobio','Clínica Biobío',                     true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'unap',         'U. Arturo Prat',                     true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'umag',         'U. de Magallanes',                   true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'tricot',       'Tricot',                             true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'sparta',       'Deportes Sparta',                    true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'aramark',      'Aramark Chile',                      true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'brinks',       'Brink''s Chile',                     true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'prisa',        'Prisa Depot',                        true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
