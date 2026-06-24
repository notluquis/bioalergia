-- Job Radar — cemento/acero (Trabajando, validadas en vivo 2026-06-24).
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TRABAJANDO', 'azachile',           'Gerdau Aza (Aceros AZA)', true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'empleoscbb',         'Cementos Bío Bío (CBB)',  true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'melon',              'Melón (cemento/hormigón)', true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'polpaicosoluciones', 'Cementos Polpaico',       true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
