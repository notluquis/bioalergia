-- Job Radar — top CL por ingresos/trabajadores (verificadas en vivo). Aditivo + idempotente.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'trabajos.aquachile.com', 'AquaChile',          true),
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'trabajo.watts.cl',       'Watt''s (SF)',        true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL',    'echeverria_izquierdo',   'Echeverría Izquierdo',true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL',    'carozzi',                'Carozzi (aira)',      true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'salfa',                  'Salfacorp',           true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'embonor',                'Embonor',             true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'molymet',                'Molymet',             true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'vsptwinegroup',          'Viña San Pedro Tarapacá', true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'saamlogistics',          'SAAM Logistics',      true),
  (gen_random_uuid()::text, 'TRABAJANDO',     'abc',                    'La Polar (ABC)',      true),
  (gen_random_uuid()::text, 'BUK',            'tattersall',             'Tattersall',          true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
