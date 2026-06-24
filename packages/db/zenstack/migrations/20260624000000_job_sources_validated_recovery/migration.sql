-- Job Radar — rescate de fuentes validadas desde agentes Claude 2026-06-23.
-- Solo adapters existentes; se omiten CDOHR/Avature/legacy SF no stateless.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'TRABAJANDO',  'azachile',                              'Aceros AZA / Gerdau Chile',       true),
  (gen_random_uuid()::text, 'TRABAJANDO',  'skc',                                   'SKC / SK Comercial',              true),
  (gen_random_uuid()::text, 'TRABAJANDO',  'ingevec',                               'Ingevec',                         true),
  (gen_random_uuid()::text, 'TRABAJANDO',  'sacyr',                                 'Sacyr Chile',                     true),
  (gen_random_uuid()::text, 'TRABAJANDO',  'ebco',                                  'EBCO',                            true),
  (gen_random_uuid()::text, 'HIRINGROOM',  'icsk',                                  'Sigdo Koppers Ingeniería y Construcción', true),
  (gen_random_uuid()::text, 'WORKDAY',     'acciona:wd3:ACCIONA_Employment_Channel','Acciona',                         true),
  (gen_random_uuid()::text, 'TEAMTAILOR',  'atlasrenewableenergy.na',               'Atlas Renewable Energy',          true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
