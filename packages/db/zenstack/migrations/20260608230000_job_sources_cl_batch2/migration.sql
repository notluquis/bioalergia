-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Job Radar — seed masivo de fuentes CL (batch 2)
-- Generado a mano — aplicar con: pnpm -F @finanzas/db migrate:deploy
-- 100% aditivo + idempotente (ON CONFLICT DO NOTHING). TODAS verificadas en vivo
-- (devuelven ofertas reales) corriendo el adapter contra el endpoint público.
-- Excluidas: portales agregadores genéricos (usm/santiago/uailaboral devuelven
-- TODAS las empresas, no la propia) y slugs que dan 404.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  -- Trabajando.com (slug subdominio) — bancos/seguros/retail/salud/utilities/telecom/CPG/univ
  (gen_random_uuid()::text, 'TRABAJANDO', 'scotiabank',          'Scotiabank',             true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'bice',                'Banco BICE',             true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'coopeuch',            'Coopeuch',               true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'consorcio',           'Consorcio',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'metlife',             'MetLife',                true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'confuturo',           'Confuturo',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'principal',           'Principal',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'colmena',             'Isapre Colmena',         true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'consalud',            'Isapre Consalud',        true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'nuevamasvida',        'Isapre Nueva Masvida',   true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'smu',                 'SMU (Unimarc/Alvi)',     true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'casaideas',           'Casa&Ideas',             true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'imperial',            'Imperial',               true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'rabie',               'Rabié',                  true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'banmedica',           'Banmédica',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'redsalud',            'RedSalud',               true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'davila',              'Clínica Dávila',         true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'clinicasantamaria',   'Clínica Santa María',    true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'clinicaalemana',      'Clínica Alemana',        true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'bupa',                'Bupa / Cruz Blanca',     true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'ucsancarlos',         'UC Christus',            true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'mutual',              'Mutual de Seguridad',    true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'inacap',              'INACAP',                 true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'duoc',                'Duoc UC',                true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'usach',               'USACH',                  true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'udec',                'U. de Concepción',       true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'unab',                'U. Andrés Bello',        true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'uccatolica',          'PUC (Católica)',         true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'metro',               'Metro de Santiago',      true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'correos',             'Correos de Chile',       true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'enap',                'ENAP',                   true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'transelec',           'Transelec',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'chilquinta',          'Chilquinta',             true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'gasco',               'GASCO',                  true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'lipigas',             'Lipigas',                true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'grupogtd',            'Grupo GTD',              true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'wom',                 'WOM',                    true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'embotelladoraandina', 'Embotelladora Andina',   true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'soprole',             'Soprole',                true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'watts',               'Watt''s',                true),
  (gen_random_uuid()::text, 'TRABAJANDO', 'empresasiansa',       'Empresas Iansa',         true),
  -- SuccessFactors RMK (identifier = host) — minería/retail-farma/tecnología
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'careers.bhp.com',         'BHP / Escondida',     true),
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'jobs.fcx.com',            'Freeport / El Abra',  true),
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'carrera.sonda.com',       'Sonda',               true),
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'careers.femsasalud.com',  'Cruz Verde / FASA',   true),
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'trabajos.cmp.cl',         'CAP / CMP',           true),
  (gen_random_uuid()::text, 'SUCCESSFACTORS', 'recruitment.jetsmart.net','JetSmart',            true),
  -- airavirtual (slug feed)
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'forus',                          'Forus',            true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'enaex',                          'Enaex',            true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'jardines_infantiles_integra',    'Integra (jardines)', true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'oficinas_regionales_integra',    'Integra (oficinas)', true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'esval-aguasdelvalle',            'Esval / Aguas del Valle', true),
  (gen_random_uuid()::text, 'AIRAVIRTUAL', 'grupo_saesa',                    'Grupo Saesa',      true),
  -- SmartRecruiters (companyId, case-sensitive)
  (gen_random_uuid()::text, 'SMARTRECRUITERS', 'AngloAmericanDeBeersGroup',  'Anglo American',   true),
  -- Workday (tenant:wdN:site)
  (gen_random_uuid()::text, 'WORKDAY', 'santander:wd3:SantanderCareers',                  'Santander', true),
  (gen_random_uuid()::text, 'WORKDAY', 'albemarle:wd5:External',                          'Albemarle', true),
  (gen_random_uuid()::text, 'WORKDAY', 'unilever:wd3:Unilever_Experienced_Professionals', 'Unilever',  true),
  (gen_random_uuid()::text, 'WORKDAY', 'aes:wd1:AES_ANDES',                               'AES Andes', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
