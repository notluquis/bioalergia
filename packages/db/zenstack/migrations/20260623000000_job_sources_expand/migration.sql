-- Job Radar — expansión cobertura CL 2026-06-23.
-- Bancos/AFP/seguros, retail, universidades, holdings, industria. Cada fila
-- VALIDADA en vivo contra su feed ATS (Trabajando /api/config/portal + searchjob,
-- Teamtailor /jobs.json, Buk /trabaja-con-nosotros). Solo fuentes scope-Chile:
-- se descartaron boards globales (Greenhouse/Lever/Ashby sin filtro país →
-- inundarían el radar con ofertas no-CL). SmartRecruiters Securitas descartado
-- (country=cl → 0 ofertas). Portales con 0 ofertas hoy se incluyen igual: son
-- portales reales registrados, el scraper maneja vacíos y captará futuras ofertas.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  -- Bancos / financieras
  (gen_random_uuid()::text, 'TRABAJANDO', 'bci',            'Banco BCI',                true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'bancofalabella', 'Banco Falabella',          true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'itau',           'Banco Itaú',               true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'forum',          'Forum',                    true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'euroamerica',    'EuroAmerica',              true),
  -- AFP / seguros / cajas
  (gen_random_uuid()::text, 'TRABAJANDO', 'cuprum',         'AFP Cuprum',               true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'planvital',      'AFP PlanVital',            true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'zurich',         'Zurich',                   true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'mapfre',         'Mapfre',                   true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'cardif',         'BNP Paribas Cardif',       true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'segurossura',    'Seguros SURA',             true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'cajalosandes',   'Caja Los Andes',           true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'caja18',         'Caja 18 de Septiembre',    true),
  -- Retail / consumo / vino
  (gen_random_uuid()::text, 'TRABAJANDO', 'sodimac',        'Sodimac',                  true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'construmart',    'Construmart',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'colun',          'Colún',                    true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'santarita',      'Viña Santa Rita',          true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'conchaytoro',    'Viña Concha y Toro',       true),
  -- Industria / construcción / minería / automotriz
  (gen_random_uuid()::text, 'TRABAJANDO', 'icafal',         'Icafal',                   true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'indumotora',     'Indumotora',               true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'sqm',            'SQM',                      true),
  -- Transporte / logística
  (gen_random_uuid()::text, 'TRABAJANDO', 'agunsa',         'Agunsa',                   true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'ultramar',       'Ultramar',                 true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'chilexpress',    'Chilexpress',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'efe',            'EFE (Trenes de Chile)',    true),
  -- Universidades / educación superior
  (gen_random_uuid()::text, 'TRABAJANDO', 'usm',            'U. Técnica Federico Santa María', true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'uai',            'U. Adolfo Ibáñez',         true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'udp',            'U. Diego Portales',        true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'ucentral',       'U. Central',               true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'uandes',         'U. de los Andes',          true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'umayor',         'U. Mayor',                 true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'udla',           'U. de Las Américas (UDLA)', true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'utalca',         'U. de Talca',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'ucm',            'U. Católica del Maule',    true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'santotomas',     'Santo Tomás',              true),
  (gen_random_uuid()::text, 'BUK',        'uautonoma',      'U. Autónoma de Chile',     true),
  -- Tech / SaaS Chile (Teamtailor)
  (gen_random_uuid()::text, 'TEAMTAILOR', 'fracttal',       'Fracttal',                 true),
  (gen_random_uuid()::text, 'TEAMTAILOR', 'nubox',          'Nubox',                    true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
