-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Job Radar — seed CL batch 4 (cosecha de tenants por plataforma)
-- Aplicar con: pnpm -F @finanzas/db migrate:deploy. Aditivo + idempotente.
-- Todas verificadas en vivo (devuelven ofertas CL). Sin kinds nuevos.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  -- Buk ({slug}.buk.cl) — mid-market CL
  (gen_random_uuid()::text, 'BUK', 'inacap',          'INACAP (Buk)',          true),
  (gen_random_uuid()::text, 'BUK', 'wom',             'WOM (Buk)',             true),
  (gen_random_uuid()::text, 'BUK', 'buk',             'Buk',                   true),
  (gen_random_uuid()::text, 'BUK', 'farmaciasahumada','Farmacias Ahumada',     true),
  (gen_random_uuid()::text, 'BUK', 'andessalud',      'Andes Salud',           true),
  (gen_random_uuid()::text, 'BUK', 'iacc',            'IACC',                  true),
  (gen_random_uuid()::text, 'BUK', 'serviad',         'Serviad',               true),
  (gen_random_uuid()::text, 'BUK', 'jcs',             'JCS (Arauco)',          true),
  (gen_random_uuid()::text, 'BUK', 'cat',             'Clínica Alemana Temuco',true),
  (gen_random_uuid()::text, 'BUK', 'bdochile',        'BDO Chile',             true),
  (gen_random_uuid()::text, 'BUK', 'milugar',         'Sitrans (milugar)',     true),
  (gen_random_uuid()::text, 'BUK', 'diio',            'Diio',                  true),
  (gen_random_uuid()::text, 'BUK', 'mineraarqueros',  'Minera Arqueros',       true),
  (gen_random_uuid()::text, 'BUK', 'transbank',       'Transbank',             true),
  (gen_random_uuid()::text, 'BUK', 'aconcaguafoods',  'Aconcagua Foods',       true),
  (gen_random_uuid()::text, 'BUK', 'ipchile',         'IP Chile',              true),
  (gen_random_uuid()::text, 'BUK', 'moovmediagroup',  'Moov Media Group',      true),
  -- Trabajando.com (single-employer)
  (gen_random_uuid()::text, 'TRABAJANDO', 'tottus',             'Tottus',               true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'cencosudscotiabank', 'Cencosud Scotiabank',  true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'ist',                'IST',                  true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'bbosch',             'BBosch',               true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'clinicauandes',      'Clínica U. de los Andes', true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'copeval',            'Copeval',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'fach',               'Fuerza Aérea de Chile',true),
  -- Genomawork (slug)
  (gen_random_uuid()::text, 'GENOMAWORK', 'starbucks', 'Starbucks Chile',  true),
  (gen_random_uuid()::text, 'GENOMAWORK', 'maihue',    'Maihue',           true),
  (gen_random_uuid()::text, 'GENOMAWORK', 'acenor',    'Acenor',           true),
  (gen_random_uuid()::text, 'GENOMAWORK', 'cebra',     'Cebra',            true),
  (gen_random_uuid()::text, 'GENOMAWORK', 'lexy-cl',   'Lexy',             true),
  -- HiringRoom (slug; lista capa en ~20 más recientes/board)
  (gen_random_uuid()::text, 'HIRINGROOM', 'maletaschile',    'Maletas Chile (Head)', true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'adeccochile',     'Adecco Chile',         true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'clinicasdelcobre','Clínicas del Cobre',   true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'opcion',          'Fundación Opción',     true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'explora',         'Explora',              true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'tatachile',       'TCS Chile',            true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'laborum',         'Laborum (HiringRoom)', true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'kpmgchile',       'KPMG Chile',           true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'cic',             'CIC',                  true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'techo',           'TECHO',                true),
  (gen_random_uuid()::text, 'HIRINGROOM', 'celeoredes',      'Celeo Redes',          true),
  -- Lever (slug)
  (gen_random_uuid()::text, 'LEVER', 'coderio', 'Coderio', true),
  -- SmartRecruiters (companyId, filtrado country=cl)
  (gen_random_uuid()::text, 'SMARTRECRUITERS', 'BoschGroup',     'Bosch',    true),
  (gen_random_uuid()::text, 'SMARTRECRUITERS', 'Experian',       'Experian', true),
  (gen_random_uuid()::text, 'SMARTRECRUITERS', 'HMGroup',        'H&M',      true),
  (gen_random_uuid()::text, 'SMARTRECRUITERS', 'KrebsConsulting','Krebs',    true),
  -- Teamtailor (subdominio)
  (gen_random_uuid()::text, 'TEAMTAILOR', 'vdh', 'Von der Heide', true),
  -- Cornerstone (segundo careersite CL de Cencosud)
  (gen_random_uuid()::text, 'CORNERSTONE', 'cencosud:20', 'Cencosud (corp/regional)', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
