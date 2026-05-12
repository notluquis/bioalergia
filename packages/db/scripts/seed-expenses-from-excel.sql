-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: gastos recurrentes + préstamos desde Excel histórico Lucas
-- Período cubierto: 2025-04 → 2026-03
-- Idempotente: usa NOT EXISTS / ON CONFLICT donde aplica. Re-correr no duplica.
--
-- REQUISITOS antes de correr:
--   1. Migration aplicada con nuevas columnas:
--      - expense_services.emission_day, transaction_category_id, counterpart_id
--      - utility_bill_snapshots, provider_credentials tablas nuevas
--      - dte_purchase_details.expense_id, matched_at, match_source
--   2. Extensión pgcrypto disponible (gen_random_uuid).
--
-- NO migra:
--   - Sueldos (ya en HR module: Employee + EmployeeTimesheet)
--   - Tarjetas crédito (Paula maneja propia, Lucas le transfiere)
--
-- Status default:
--   - Meses < current month → 'PAID' (Lucas revisa y ajusta en UI los OVERDUE)
--   - Meses >= current month → 'PENDING'
--
-- Loans: principal y tasa son placeholders (cuotas exactas del Excel preservadas).
-- Lucas ajusta principal_amount + interest_rate después con datos reales.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. Categorías de transacción ───────────────────────────────────────────
INSERT INTO transaction_categories (name, color, icon, created_at, updated_at)
SELECT v.name, v.color, v.icon, NOW(), NOW()
FROM (VALUES
  ('Servicios básicos',       '#3b82f6', 'lightbulb'),
  ('Telefonía',               '#06b6d4', 'phone'),
  ('Gastos comunes',          '#8b5cf6', 'building'),
  ('Salud personal',          '#ec4899', 'heart-pulse'),
  ('Plataformas digitales',   '#6366f1', 'globe'),
  ('Educación',               '#f59e0b', 'graduation-cap'),
  ('Servicios profesionales', '#10b981', 'briefcase'),
  ('Previsionales',           '#0ea5e9', 'shield-check'),
  ('Impuestos',               '#ef4444', 'receipt'),
  ('Insumos clínicos',        '#14b8a6', 'package'),
  ('Préstamos',               '#f97316', 'banknote')
) AS v(name, color, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM transaction_categories tc WHERE tc.name = v.name
);

-- ─── 2. ExpenseService (24 servicios recurrentes) ───────────────────────────
INSERT INTO expense_services (
  public_id, name, detail, scope, category,
  billing_day, emission_day, due_date_rule, default_amount,
  is_fixed, recurrence, start_date, end_date, is_active,
  notes, tags, transaction_category_id, created_at, updated_at
)
SELECT
  'seed_' || gen_random_uuid()::text,
  v.name, v.detail, v.scope::"ExpenseScope", v.category_label,
  v.due_day, v.emission_day, v.due_rule, v.default_amount,
  v.is_fixed, v.recurrence::"ExpenseRecurrence",
  v.start_date::date, v.end_date::date, v.is_active,
  v.notes, '{}'::text[],
  (SELECT id FROM transaction_categories WHERE name = v.cat_name LIMIT 1),
  NOW(), NOW()
FROM (VALUES
  -- name              | detail           | scope        | cat_name              | cat_label   | due_day | emis_day | due_rule                | default | fixed | recurr   | start_date | end_date     | active | notes
  ('Movistar',          'Empresa',         'BIOALERGIA',  'Telefonía',              'telefonia',  NULL::int, NULL::int, NULL,                     65153,    false, 'MONTHLY', '2025-04-01', NULL,         true,   'Línea empresa'),
  ('Telesur',           'Internet + TV',   'BIOALERGIA',  'Servicios básicos',      'servicios',  25,        5,         '25 mes siguiente',       35200,    false, 'MONTHLY', '2025-04-01', NULL,         true,   NULL),
  ('CGE',               'ID: 6783234',     'BIOALERGIA',  'Servicios básicos',      'servicios',  27,        11,        '25-26-27',               168000,   false, 'MONTHLY', '2025-04-01', NULL,         true,   'Electricidad clínica'),
  ('CGE',               'ID: 5819700',     'PERSONAL',    'Servicios básicos',      'servicios',  28,        9,         '28 mes siguiente',       67000,    false, 'MONTHLY', '2025-04-01', NULL,         true,   'Electricidad casa'),
  ('Essbio',            'ID: 1636513-0',   'BIOALERGIA',  'Servicios básicos',      'servicios',  28,        NULL,      NULL,                     45000,    false, 'MONTHLY', '2025-04-01', NULL,         true,   'Agua clínica'),
  ('Essbio',            'ID: 60153040-6',  'PERSONAL',    'Servicios básicos',      'servicios',  5,         20,        '5 mes siguiente',        32000,    false, 'MONTHLY', '2025-04-01', NULL,         true,   'Agua casa'),
  ('Gastos comunes',    'Consulta',        'BIOALERGIA',  'Gastos comunes',         'comunes',    30,        1,         '30 mes siguiente',       160000,   false, 'MONTHLY', '2025-04-01', NULL,         true,   NULL),
  ('Gastos comunes',    'Estacionamiento', 'BIOALERGIA',  'Gastos comunes',         'comunes',    30,        1,         '30 mes siguiente',       12500,    false, 'MONTHLY', '2025-04-01', NULL,         true,   NULL),
  ('Movistar',          NULL,              'PERSONAL',    'Telefonía',              'telefonia',  21,        1,         NULL,                     45000,    false, 'MONTHLY', '2025-04-01', NULL,         true,   'Línea personal'),
  ('Isapre',            'MasVida',         'PERSONAL',    'Salud personal',         'salud',      NULL,      NULL,      NULL,                     380605,   true,  'MONTHLY', '2025-04-01', '2025-08-31', false,  'Cancelado desde sep-2025'),
  ('Medipass',          'ID: 11896644-9',  'BIOALERGIA',  'Plataformas digitales',  'plataformas',15,        NULL,      '15 mes siguiente',       45000,    false, 'MONTHLY', '2025-08-01', NULL,         true,   'Ex-IMED, llega DTE compra'),
  ('Gira Estudios',     NULL,              'PERSONAL',    'Educación',              'educacion',  31,        NULL,      NULL,                     112603,   true,  'MONTHLY', '2025-04-01', '2025-10-31', false,  'Cancelado desde nov-2025'),
  ('Contadora',         NULL,              'BIOALERGIA',  'Servicios profesionales','servicios_pro',30,      NULL,      NULL,                     200000,   true,  'MONTHLY', '2025-04-01', NULL,         true,   'Llega DTE compra'),
  ('Colegio',           NULL,              'PERSONAL',    'Educación',              'educacion',  10,        NULL,      NULL,                     468960,   true,  'MONTHLY', '2025-04-01', '2025-12-31', false,  'Termina año escolar dic-2025'),
  ('Imposiciones',      NULL,              'BIOALERGIA',  'Previsionales',          'previsionales',13,      NULL,      '13 de cada mes (Previred)',135000,  false, 'MONTHLY', '2025-04-01', NULL,         true,   'Variable según UF y plan'),
  ('Doctoralia',        NULL,              'BIOALERGIA',  'Plataformas digitales',  'plataformas',15,        NULL,      NULL,                     81000,    true,  'MONTHLY', '2025-04-01', NULL,         true,   NULL),
  ('F29',               NULL,              'BIOALERGIA',  'Impuestos',              'impuestos',  20,        NULL,      '20 mes siguiente (online)',NULL,    false, 'MONTHLY', '2025-04-01', NULL,         true,   'Día venc varía por último dígito RUT (10-20)'),
  ('Convenio pago',     NULL,              'BIOALERGIA',  'Impuestos',              'impuestos',  NULL,      NULL,      'último mes hábil',       519681,   true,  'MONTHLY', '2025-04-01', NULL,         true,   'Plan pago SII deudas tributarias'),
  ('Promedar',          NULL,              'BIOALERGIA',  'Insumos clínicos',       'insumos',    NULL,      NULL,      NULL,                     NULL,     false, 'MONTHLY', '2025-04-01', NULL,         true,   'Proveedor insumos'),
  ('Allos',             NULL,              'BIOALERGIA',  'Insumos clínicos',       'insumos',    NULL,      NULL,      NULL,                     NULL,     false, 'MONTHLY', '2025-04-01', NULL,         true,   'Proveedor insumos'),
  ('Inmunodiagnóstico', NULL,              'BIOALERGIA',  'Insumos clínicos',       'insumos',    NULL,      NULL,      NULL,                     NULL,     false, 'MONTHLY', '2025-04-01', NULL,         true,   'Proveedor insumos'),
  ('Paula Flores',      NULL,              'PERSONAL',    'Servicios profesionales','servicios_pro',NULL,    NULL,      NULL,                     NULL,     false, 'MONTHLY', '2025-04-01', NULL,         true,   'Gastos esposa'),
  ('Insumos',           NULL,              'BIOALERGIA',  'Insumos clínicos',       'insumos',    NULL,      NULL,      NULL,                     NULL,     false, 'MONTHLY', '2025-04-01', NULL,         true,   'Insumos genéricos clínica'),
  ('TGR',               NULL,              'PERSONAL',    'Impuestos',              'impuestos',  NULL,      NULL,      NULL,                     NULL,     false, 'ONE_TIME','2025-04-01', NULL,         true,   'Esporádico')
) AS v(name, detail, scope, cat_name, category_label, due_day, emission_day, due_rule, default_amount, is_fixed, recurrence, start_date, end_date, is_active, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM expense_services es
   WHERE es.name = v.name
     AND COALESCE(es.detail, '') = COALESCE(v.detail, '')
     AND es.scope = v.scope::"ExpenseScope"
);

-- ─── 3. Expenses mensuales (instancias) ─────────────────────────────────────
-- Status: meses < 2026-05 → 'PAID', meses >= 2026-05 → 'PENDING'
-- Solo se insertan filas con monto > 0.

INSERT INTO expenses (
  public_id, service_id, name, detail, scope, expense_month,
  due_date, amount_expected, amount_applied, status, source, category,
  notes, tags, created_at, updated_at
)
SELECT
  'seed_' || gen_random_uuid()::text,
  (SELECT id FROM expense_services
    WHERE name = v.svc_name
      AND COALESCE(detail, '') = COALESCE(v.svc_detail, '')
      AND scope = v.svc_scope::"ExpenseScope"
    LIMIT 1),
  v.svc_name,
  v.svc_detail,
  v.svc_scope::"ExpenseScope",
  v.expense_month,
  v.due_date::date,
  v.amount,
  0,
  v.status::"ExpenseStatus",
  'TEMPLATE'::"ExpenseSource",
  v.category_label,
  NULL,
  '{}'::text[],
  NOW(), NOW()
FROM (VALUES
  -- svc_name        | svc_detail        | svc_scope    | expense_month | due_date     | amount   | status   | cat_label
  -- Movistar Empresa (solo Aug-25)
  ('Movistar',         'Empresa',          'BIOALERGIA',  '2025-08',      NULL,           65153,    'PAID',    'telefonia'),
  -- Telesur (5 meses)
  ('Telesur',          'Internet + TV',    'BIOALERGIA',  '2025-04',      '2025-05-25',   34949,    'PAID',    'servicios'),
  ('Telesur',          'Internet + TV',    'BIOALERGIA',  '2025-05',      '2025-06-25',   35199,    'PAID',    'servicios'),
  ('Telesur',          'Internet + TV',    'BIOALERGIA',  '2025-06',      '2025-07-25',   35299,    'PAID',    'servicios'),
  ('Telesur',          'Internet + TV',    'BIOALERGIA',  '2025-07',      '2025-08-25',   35435,    'PAID',    'servicios'),
  ('Telesur',          'Internet + TV',    'BIOALERGIA',  '2025-08',      '2025-09-25',   35407,    'PAID',    'servicios'),
  -- CGE Bio (5 meses)
  ('CGE',              'ID: 6783234',      'BIOALERGIA',  '2025-04',      '2025-04-27',   123800,   'PAID',    'servicios'),
  ('CGE',              'ID: 6783234',      'BIOALERGIA',  '2025-05',      '2025-05-27',   152900,   'PAID',    'servicios'),
  ('CGE',              'ID: 6783234',      'BIOALERGIA',  '2025-06',      '2025-06-27',   216319,   'PAID',    'servicios'),
  ('CGE',              'ID: 6783234',      'BIOALERGIA',  '2025-07',      '2025-07-27',   179500,   'PAID',    'servicios'),
  ('CGE',              'ID: 6783234',      'BIOALERGIA',  '2025-08',      '2025-08-27',   168318,   'PAID',    'servicios'),
  -- CGE Personal (5 meses)
  ('CGE',              'ID: 5819700',      'PERSONAL',    '2025-04',      '2025-05-28',   40800,    'PAID',    'servicios'),
  ('CGE',              'ID: 5819700',      'PERSONAL',    '2025-05',      '2025-06-28',   79609,    'PAID',    'servicios'),
  ('CGE',              'ID: 5819700',      'PERSONAL',    '2025-06',      '2025-07-28',   88100,    'PAID',    'servicios'),
  ('CGE',              'ID: 5819700',      'PERSONAL',    '2025-07',      '2025-08-28',   77400,    'PAID',    'servicios'),
  ('CGE',              'ID: 5819700',      'PERSONAL',    '2025-08',      '2025-09-28',   50448,    'PAID',    'servicios'),
  -- Essbio Bio
  ('Essbio',           'ID: 1636513-0',    'BIOALERGIA',  '2025-04',      '2025-04-28',   44370,    'PAID',    'servicios'),
  ('Essbio',           'ID: 1636513-0',    'BIOALERGIA',  '2025-05',      '2025-05-28',   71340,    'PAID',    'servicios'),
  ('Essbio',           'ID: 1636513-0',    'BIOALERGIA',  '2025-06',      '2025-06-28',   21300,    'PAID',    'servicios'),
  ('Essbio',           'ID: 1636513-0',    'BIOALERGIA',  '2025-07',      '2025-07-28',   69950,    'PAID',    'servicios'),
  ('Essbio',           'ID: 1636513-0',    'BIOALERGIA',  '2025-08',      '2025-08-28',   22473,    'PAID',    'servicios'),
  -- Essbio Personal
  ('Essbio',           'ID: 60153040-6',   'PERSONAL',    '2025-04',      '2025-05-05',   31010,    'PAID',    'servicios'),
  ('Essbio',           'ID: 60153040-6',   'PERSONAL',    '2025-05',      '2025-06-05',   35730,    'PAID',    'servicios'),
  ('Essbio',           'ID: 60153040-6',   'PERSONAL',    '2025-06',      '2025-07-05',   27280,    'PAID',    'servicios'),
  ('Essbio',           'ID: 60153040-6',   'PERSONAL',    '2025-07',      '2025-08-05',   35140,    'PAID',    'servicios'),
  ('Essbio',           'ID: 60153040-6',   'PERSONAL',    '2025-08',      '2025-09-05',   31850,    'PAID',    'servicios'),
  -- Gastos comunes Consulta
  ('Gastos comunes',   'Consulta',         'BIOALERGIA',  '2025-04',      '2025-05-30',   147068,   'PAID',    'comunes'),
  ('Gastos comunes',   'Consulta',         'BIOALERGIA',  '2025-05',      '2025-06-30',   175195,   'PAID',    'comunes'),
  ('Gastos comunes',   'Consulta',         'BIOALERGIA',  '2025-06',      '2025-07-30',   175158,   'PAID',    'comunes'),
  ('Gastos comunes',   'Consulta',         'BIOALERGIA',  '2025-07',      '2025-08-30',   159667,   'PAID',    'comunes'),
  ('Gastos comunes',   'Consulta',         'BIOALERGIA',  '2025-08',      '2025-09-30',   165602,   'PAID',    'comunes'),
  ('Gastos comunes',   'Consulta',         'BIOALERGIA',  '2025-09',      '2025-10-30',   155425,   'PAID',    'comunes'),
  -- Gastos comunes Estacionamiento
  ('Gastos comunes',   'Estacionamiento',  'BIOALERGIA',  '2025-04',      '2025-05-30',   11410,    'PAID',    'comunes'),
  ('Gastos comunes',   'Estacionamiento',  'BIOALERGIA',  '2025-05',      '2025-06-30',   13593,    'PAID',    'comunes'),
  ('Gastos comunes',   'Estacionamiento',  'BIOALERGIA',  '2025-06',      '2025-07-30',   13590,    'PAID',    'comunes'),
  ('Gastos comunes',   'Estacionamiento',  'BIOALERGIA',  '2025-07',      '2025-08-30',   12388,    'PAID',    'comunes'),
  ('Gastos comunes',   'Estacionamiento',  'BIOALERGIA',  '2025-08',      '2025-09-30',   12848,    'PAID',    'comunes'),
  ('Gastos comunes',   'Estacionamiento',  'BIOALERGIA',  '2025-09',      '2025-10-30',   12059,    'PAID',    'comunes'),
  -- Movistar Personal (4 meses, terminó)
  ('Movistar',         NULL,               'PERSONAL',    '2025-04',      '2025-04-21',   45684,    'PAID',    'telefonia'),
  ('Movistar',         NULL,               'PERSONAL',    '2025-05',      '2025-05-21',   46308,    'PAID',    'telefonia'),
  ('Movistar',         NULL,               'PERSONAL',    '2025-06',      '2025-06-21',   46369,    'PAID',    'telefonia'),
  ('Movistar',         NULL,               'PERSONAL',    '2025-07',      '2025-07-21',   41804,    'PAID',    'telefonia'),
  -- Isapre MasVida (5 meses, terminó)
  ('Isapre',           'MasVida',          'PERSONAL',    '2025-04',      NULL,           380605,   'PAID',    'salud'),
  ('Isapre',           'MasVida',          'PERSONAL',    '2025-05',      NULL,           380605,   'PAID',    'salud'),
  ('Isapre',           'MasVida',          'PERSONAL',    '2025-06',      NULL,           380605,   'PAID',    'salud'),
  ('Isapre',           'MasVida',          'PERSONAL',    '2025-07',      NULL,           380605,   'PAID',    'salud'),
  ('Isapre',           'MasVida',          'PERSONAL',    '2025-08',      NULL,           380605,   'PAID',    'salud'),
  -- Medipass (ex-IMED, 4 meses como IMED)
  ('Medipass',         'ID: 11896644-9',   'BIOALERGIA',  '2025-04',      '2025-05-15',   43757,    'PAID',    'plataformas'),
  ('Medipass',         'ID: 11896644-9',   'BIOALERGIA',  '2025-05',      '2025-06-15',   42807,    'PAID',    'plataformas'),
  ('Medipass',         'ID: 11896644-9',   'BIOALERGIA',  '2025-06',      '2025-07-15',   41811,    'PAID',    'plataformas'),
  ('Medipass',         'ID: 11896644-9',   'BIOALERGIA',  '2025-07',      '2025-08-15',   53305,    'PAID',    'plataformas'),
  -- Gira Estudios (7 meses, terminó oct-25)
  ('Gira Estudios',    NULL,               'PERSONAL',    '2025-04',      '2025-04-30',   112603,   'PAID',    'educacion'),
  ('Gira Estudios',    NULL,               'PERSONAL',    '2025-05',      '2025-05-31',   112603,   'PAID',    'educacion'),
  ('Gira Estudios',    NULL,               'PERSONAL',    '2025-06',      '2025-06-30',   112603,   'PAID',    'educacion'),
  ('Gira Estudios',    NULL,               'PERSONAL',    '2025-07',      '2025-07-31',   112603,   'PAID',    'educacion'),
  ('Gira Estudios',    NULL,               'PERSONAL',    '2025-08',      '2025-08-31',   112603,   'PAID',    'educacion'),
  ('Gira Estudios',    NULL,               'PERSONAL',    '2025-09',      '2025-09-30',   112603,   'PAID',    'educacion'),
  ('Gira Estudios',    NULL,               'PERSONAL',    '2025-10',      '2025-10-31',   112603,   'PAID',    'educacion'),
  -- Contadora (12 meses)
  ('Contadora',        NULL,               'BIOALERGIA',  '2025-04',      '2025-04-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2025-05',      '2025-05-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2025-06',      '2025-06-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2025-07',      '2025-07-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2025-08',      '2025-08-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2025-09',      '2025-09-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2025-10',      '2025-10-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2025-11',      '2025-11-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2025-12',      '2025-12-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2026-01',      '2026-01-30',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2026-02',      '2026-02-28',   200000,   'PAID',    'servicios_pro'),
  ('Contadora',        NULL,               'BIOALERGIA',  '2026-03',      '2026-03-30',   200000,   'PAID',    'servicios_pro'),
  -- Colegio (9 meses, terminó dic-25)
  ('Colegio',          NULL,               'PERSONAL',    '2025-04',      '2025-04-10',   468960,   'PAID',    'educacion'),
  ('Colegio',          NULL,               'PERSONAL',    '2025-05',      '2025-05-10',   468960,   'PAID',    'educacion'),
  ('Colegio',          NULL,               'PERSONAL',    '2025-06',      '2025-06-10',   468960,   'PAID',    'educacion'),
  ('Colegio',          NULL,               'PERSONAL',    '2025-07',      '2025-07-10',   468960,   'PAID',    'educacion'),
  ('Colegio',          NULL,               'PERSONAL',    '2025-08',      '2025-08-10',   468960,   'PAID',    'educacion'),
  ('Colegio',          NULL,               'PERSONAL',    '2025-09',      '2025-09-10',   468960,   'PAID',    'educacion'),
  ('Colegio',          NULL,               'PERSONAL',    '2025-10',      '2025-10-10',   468960,   'PAID',    'educacion'),
  ('Colegio',          NULL,               'PERSONAL',    '2025-11',      '2025-11-10',   468960,   'PAID',    'educacion'),
  ('Colegio',          NULL,               'PERSONAL',    '2025-12',      '2025-12-10',   468960,   'PAID',    'educacion'),
  -- Imposiciones (4 meses con monto en Excel)
  ('Imposiciones',     NULL,               'BIOALERGIA',  '2025-04',      '2025-05-13',   132933,   'PAID',    'previsionales'),
  ('Imposiciones',     NULL,               'BIOALERGIA',  '2025-05',      '2025-06-13',   135549,   'PAID',    'previsionales'),
  ('Imposiciones',     NULL,               'BIOALERGIA',  '2025-06',      '2025-07-13',   135679,   'PAID',    'previsionales'),
  ('Imposiciones',     NULL,               'BIOALERGIA',  '2025-07',      '2025-08-13',   136060,   'PAID',    'previsionales'),
  -- Doctoralia (12 meses)
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2025-04',      '2025-04-15',   91100,    'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2025-05',      '2025-05-15',   81000,    'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2025-06',      '2025-06-15',   118000,   'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2025-07',      '2025-07-15',   118000,   'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2025-08',      '2025-08-15',   81000,    'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2025-09',      '2025-09-15',   81000,    'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2025-10',      '2025-10-15',   81000,    'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2025-11',      '2025-11-15',   81000,    'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2025-12',      '2025-12-15',   81000,    'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2026-01',      '2026-01-15',   81000,    'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2026-02',      '2026-02-15',   81000,    'PAID',    'plataformas'),
  ('Doctoralia',       NULL,               'BIOALERGIA',  '2026-03',      '2026-03-15',   81000,    'PAID',    'plataformas'),
  -- F29 (3 meses con monto Excel)
  ('F29',              NULL,               'BIOALERGIA',  '2025-04',      '2025-05-20',   596675,   'PAID',    'impuestos'),
  ('F29',              NULL,               'BIOALERGIA',  '2025-05',      '2025-06-20',   493924,   'PAID',    'impuestos'),
  ('F29',              NULL,               'BIOALERGIA',  '2025-06',      '2025-07-20',   774310,   'PAID',    'impuestos'),
  -- Convenio pago (12 meses fijo 519681)
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2025-04',      '2025-04-30',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2025-05',      '2025-05-30',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2025-06',      '2025-06-30',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2025-07',      '2025-07-31',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2025-08',      '2025-08-29',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2025-09',      '2025-09-30',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2025-10',      '2025-10-31',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2025-11',      '2025-11-28',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2025-12',      '2025-12-31',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2026-01',      '2026-01-30',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2026-02',      '2026-02-27',   519681,   'PAID',    'impuestos'),
  ('Convenio pago',    NULL,               'BIOALERGIA',  '2026-03',      '2026-03-31',   519681,   'PENDING', 'impuestos')
) AS v(svc_name, svc_detail, svc_scope, expense_month, due_date, amount, status, category_label)
WHERE NOT EXISTS (
  SELECT 1 FROM expenses e
   WHERE e.service_id = (SELECT id FROM expense_services
                          WHERE name = v.svc_name
                            AND COALESCE(detail, '') = COALESCE(v.svc_detail, '')
                            AND scope = v.svc_scope::"ExpenseScope"
                          LIMIT 1)
     AND e.expense_month = v.expense_month
);

-- ─── 4. Loans ────────────────────────────────────────────────────────────────
-- principal_amount es placeholder (suma cuotas Excel). interest_rate = 0.
-- Lucas ajusta con datos reales del banco después.

INSERT INTO loans (
  public_id, title, borrower_name, borrower_type,
  principal_amount, interest_rate, interest_type, frequency,
  total_installments, notes, start_date, status, created_at, updated_at
)
SELECT
  v.public_id, v.title, v.borrower_name, v.borrower_type::"LoanBorrowerType",
  v.principal_amount, v.interest_rate, v.interest_type::"LoanInterestType", v.frequency::"LoanFrequency",
  v.total_installments, v.notes, v.start_date::date, v.status::"LoanStatus",
  NOW(), NOW()
FROM (VALUES
  -- public_id           | title                       | borrower_name | borrower_type | principal | rate | type       | freq      | total | notes                                             | start_date   | status
  ('seed_loan_caram',     'CARAM',                      'Lucas',        'PERSON',     8966980,    0.0,   'SIMPLE',    'MONTHLY',  7,      'Migrado Excel — ajustar principal/rate real',     '2025-04-10',  'COMPLETED'),
  ('seed_loan_socofin_c', 'SOCOFIN Consumo',            'Lucas',        'PERSON',     700776,     0.0,   'SIMPLE',    'MONTHLY',  12,     'Migrado Excel — ajustar principal/rate real',     '2025-04-24',  'ACTIVE'),
  ('seed_loan_socofin_r', 'SOCOFIN Renegociado',        'Lucas',        'PERSON',     653106,     0.0,   'SIMPLE',    'MONTHLY',  12,     'Migrado Excel — ajustar principal/rate real',     '2025-04-24',  'ACTIVE'),
  ('seed_loan_fogape1',   'FOGAPE 1',                   'Lucas',        'PERSON',     6128485,    0.0,   'SIMPLE',    'MONTHLY',  11,     'Migrado Excel — ajustar principal/rate real',     '2025-04-06',  'ACTIVE'),
  ('seed_loan_fogape2',   'FOGAPE 2',                   'Lucas',        'PERSON',     1881070,    0.0,   'SIMPLE',    'MONTHLY',  12,     'Migrado Excel — ajustar principal/rate real',     '2025-04-27',  'ACTIVE'),
  ('seed_loan_hipotecario','Hipotecario',               'Lucas',        'PERSON',     5054000,    0.0,   'SIMPLE',    'MONTHLY',  4,      'Migrado Excel — reemplazado por Renegociado',     '2025-04-10',  'COMPLETED'),
  ('seed_loan_renegociado','RENEGOCIADO Cuotón',        'Lucas',        'PERSON',     9288099,    0.0,   'SIMPLE',    'MONTHLY',  9,      'Migrado Excel — renegociación hipoteca',          '2025-07-01',  'ACTIVE')
) AS v(public_id, title, borrower_name, borrower_type, principal_amount, interest_rate, interest_type, frequency, total_installments, notes, start_date, status)
WHERE NOT EXISTS (SELECT 1 FROM loans WHERE public_id = v.public_id);

-- ─── 5. LoanSchedule (cuotas de cada préstamo) ─────────────────────────────
-- expected_amount = monto Excel. expected_principal = expected_amount, expected_interest = 0 (placeholder).
-- paid_amount/paid_date NULL → Lucas marca pagado en UI.

INSERT INTO loan_schedules (
  loan_id, installment_number, due_date, expected_amount,
  expected_principal, expected_interest, paid_amount, paid_date, status
)
SELECT
  (SELECT id FROM loans WHERE public_id = v.loan_pid LIMIT 1),
  v.installment_number, v.due_date::date, v.expected_amount,
  v.expected_amount, 0,
  NULL, NULL,
  v.status::"LoanScheduleStatus"
FROM (VALUES
  -- CARAM (7 cuotas)
  ('seed_loan_caram',      1, '2025-04-10', 1409112, 'PAID'),
  ('seed_loan_caram',      2, '2025-05-10', 1410896, 'PAID'),
  ('seed_loan_caram',      3, '2025-06-10', 1289768, 'PAID'),
  ('seed_loan_caram',      4, '2025-07-10', 1291596, 'PAID'),
  ('seed_loan_caram',      5, '2025-08-10', 1282804, 'PAID'),
  ('seed_loan_caram',      6, '2025-09-10', 1282804, 'PAID'),
  ('seed_loan_caram',      7, '2025-10-10', 1282804, 'PAID'),
  -- SOCOFIN Consumo (12 cuotas)
  ('seed_loan_socofin_c',  1, '2025-04-24', 59056,  'PAID'),
  ('seed_loan_socofin_c',  2, '2025-05-24', 58398,  'PAID'),
  ('seed_loan_socofin_c',  3, '2025-06-24', 58398,  'PAID'),
  ('seed_loan_socofin_c',  4, '2025-07-24', 58798,  'PAID'),
  ('seed_loan_socofin_c',  5, '2025-08-24', 58398,  'PAID'),
  ('seed_loan_socofin_c',  6, '2025-09-24', 58398,  'PAID'),
  ('seed_loan_socofin_c',  7, '2025-10-24', 58398,  'PAID'),
  ('seed_loan_socofin_c',  8, '2025-11-24', 58398,  'PAID'),
  ('seed_loan_socofin_c',  9, '2025-12-24', 58398,  'PAID'),
  ('seed_loan_socofin_c', 10, '2026-01-24', 58398,  'PAID'),
  ('seed_loan_socofin_c', 11, '2026-02-24', 58398,  'PAID'),
  ('seed_loan_socofin_c', 12, '2026-03-24', 58398,  'PENDING'),
  -- SOCOFIN Renegociado (12 cuotas)
  ('seed_loan_socofin_r',  1, '2025-04-24', 54410,  'PAID'),
  ('seed_loan_socofin_r',  2, '2025-05-24', 54410,  'PAID'),
  ('seed_loan_socofin_r',  3, '2025-06-24', 54410,  'PAID'),
  ('seed_loan_socofin_r',  4, '2025-07-24', 54596,  'PAID'),
  ('seed_loan_socofin_r',  5, '2025-08-24', 54410,  'PAID'),
  ('seed_loan_socofin_r',  6, '2025-09-24', 54410,  'PAID'),
  ('seed_loan_socofin_r',  7, '2025-10-24', 54410,  'PAID'),
  ('seed_loan_socofin_r',  8, '2025-11-24', 54410,  'PAID'),
  ('seed_loan_socofin_r',  9, '2025-12-24', 54410,  'PAID'),
  ('seed_loan_socofin_r', 10, '2026-01-24', 54410,  'PAID'),
  ('seed_loan_socofin_r', 11, '2026-02-24', 54410,  'PAID'),
  ('seed_loan_socofin_r', 12, '2026-03-24', 54410,  'PENDING'),
  -- FOGAPE 1 (11 cuotas, decreciente, mar-26 = $-)
  ('seed_loan_fogape1',    1, '2025-04-06', 602305, 'PAID'),
  ('seed_loan_fogape1',    2, '2025-05-06', 557712, 'PAID'),
  ('seed_loan_fogape1',    3, '2025-06-06', 553554, 'OVERDUE'),
  ('seed_loan_fogape1',    4, '2025-07-06', 553219, 'OVERDUE'),
  ('seed_loan_fogape1',    5, '2025-08-06', 552800, 'OVERDUE'),
  ('seed_loan_fogape1',    6, '2025-09-06', 552676, 'PAID'),
  ('seed_loan_fogape1',    7, '2025-10-06', 552013, 'PAID'),
  ('seed_loan_fogape1',    8, '2025-11-06', 551833, 'PAID'),
  ('seed_loan_fogape1',    9, '2025-12-06', 551546, 'PAID'),
  ('seed_loan_fogape1',   10, '2026-01-06', 551041, 'PAID'),
  ('seed_loan_fogape1',   11, '2026-02-06', 550746, 'PENDING'),
  -- FOGAPE 2 (12 cuotas)
  ('seed_loan_fogape2',    1, '2025-04-27', 169935, 'PAID'),
  ('seed_loan_fogape2',    2, '2025-05-27', 155516, 'PAID'),
  ('seed_loan_fogape2',    3, '2025-06-27', 155650, 'OVERDUE'),
  ('seed_loan_fogape2',    4, '2025-07-27', 155577, 'OVERDUE'),
  ('seed_loan_fogape2',    5, '2025-08-27', 155407, 'OVERDUE'),
  ('seed_loan_fogape2',    6, '2025-09-27', 155618, 'PAID'),
  ('seed_loan_fogape2',    7, '2025-10-27', 155078, 'PAID'),
  ('seed_loan_fogape2',    8, '2025-11-27', 155277, 'PAID'),
  ('seed_loan_fogape2',    9, '2025-12-27', 155288, 'PAID'),
  ('seed_loan_fogape2',   10, '2026-01-27', 154954, 'PAID'),
  ('seed_loan_fogape2',   11, '2026-02-27', 154044, 'PAID'),
  ('seed_loan_fogape2',   12, '2026-03-27', 154726, 'PENDING'),
  -- HIPOTECARIO (4 cuotas, terminó jul-25)
  ('seed_loan_hipotecario',1, '2025-04-10', 1260000,'PAID'),
  ('seed_loan_hipotecario',2, '2025-05-10', 1260000,'PAID'),
  ('seed_loan_hipotecario',3, '2025-06-10', 1265000,'PAID'),
  ('seed_loan_hipotecario',4, '2025-07-10', 1269000,'PAID'),
  -- RENEGOCIADO Cuotón (9 cuotas, empezó jul-25)
  ('seed_loan_renegociado',1, '2025-07-15', 1036011,'PAID'),
  ('seed_loan_renegociado',2, '2025-08-15', 1028011,'PAID'),
  ('seed_loan_renegociado',3, '2025-09-15', 1028011,'PAID'),
  ('seed_loan_renegociado',4, '2025-10-15', 1028011,'PAID'),
  ('seed_loan_renegociado',5, '2025-11-15', 1028011,'PAID'),
  ('seed_loan_renegociado',6, '2025-12-15', 1028011,'PAID'),
  ('seed_loan_renegociado',7, '2026-01-15', 1028011,'PAID'),
  ('seed_loan_renegociado',8, '2026-02-15', 1028011,'PAID'),
  ('seed_loan_renegociado',9, '2026-03-15', 1028011,'PENDING')
) AS v(loan_pid, installment_number, due_date, expected_amount, status)
WHERE NOT EXISTS (
  SELECT 1 FROM loan_schedules lsi
   WHERE lsi.loan_id = (SELECT id FROM loans WHERE public_id = v.loan_pid LIMIT 1)
     AND lsi.installment_number = v.installment_number
);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación: counts esperados
--   transaction_categories: +11 (si no había)
--   expense_services: 24
--   expenses: ~110 (depende meses con monto)
--   loans: 7
--   loan_schedules: 67
-- ─────────────────────────────────────────────────────────────────────────────
