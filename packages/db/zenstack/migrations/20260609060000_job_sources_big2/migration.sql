-- Job Radar — más grandes (verificadas en vivo). Aditivo + idempotente.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TRABAJANDO', 'ccu',                'CCU',                 true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'entel',              'Entel (Trabajando)',  true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'sodexo',             'Sodexo Chile',        true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'clarochile',         'Claro Chile',         true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'bancointernacional', 'Banco Internacional', true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'mallplaza',          'Mallplaza',           true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL','aguas_andinas',      'Aguas Andinas',       true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
