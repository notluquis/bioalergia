-- Expand auto-category rules to support amount/text conditions
-- ZenStack migration

ALTER TABLE public.financial_auto_category_rules
  ALTER COLUMN counterpart_id DROP NOT NULL;

ALTER TABLE public.financial_auto_category_rules
  ADD COLUMN IF NOT EXISTS min_amount NUMERIC(19,4),
  ADD COLUMN IF NOT EXISTS max_amount NUMERIC(19,4),
  ADD COLUMN IF NOT EXISTS comment_contains TEXT,
  ADD COLUMN IF NOT EXISTS description_contains TEXT;

DROP INDEX IF EXISTS public.financial_auto_category_rules_source_type_counterpart_id_key;

-- Ensure category Pacientes (INCOME) exists
INSERT INTO public.transaction_categories (name, type, created_at, updated_at)
SELECT 'Pacientes', 'INCOME'::public."TransactionType", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM public.transaction_categories
  WHERE lower(name) = lower('Pacientes')
    AND type = 'INCOME'::public."TransactionType"
);

-- Rule: INCOME 0..200000 and comment contains "Ref: Venta presencial" => Pacientes
INSERT INTO public.financial_auto_category_rules (
  name,
  source,
  type,
  counterpart_id,
  category_id,
  min_amount,
  max_amount,
  comment_contains,
  description_contains,
  is_active,
  priority
)
SELECT
  'Pacientes venta presencial <= 200000',
  'MERCADOPAGO'::public."TransactionSource",
  'INCOME'::public."TransactionType",
  NULL,
  tc.id,
  0,
  200000,
  'Ref: Venta presencial',
  NULL,
  TRUE,
  95
FROM public.transaction_categories tc
WHERE lower(tc.name) = lower('Pacientes')
  AND tc.type = 'INCOME'::public."TransactionType"
  AND NOT EXISTS (
    SELECT 1
    FROM public.financial_auto_category_rules r
    WHERE r.source = 'MERCADOPAGO'::public."TransactionSource"
      AND r.type = 'INCOME'::public."TransactionType"
      AND r.counterpart_id IS NULL
      AND r.min_amount = 0
      AND r.max_amount = 200000
      AND lower(coalesce(r.comment_contains, '')) = lower('Ref: Venta presencial')
  );
