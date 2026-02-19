-- Add configurable auto-category rules for financial transactions
-- ZenStack migration

CREATE TABLE IF NOT EXISTS public.financial_auto_category_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  source public."TransactionSource" NOT NULL DEFAULT 'MERCADOPAGO',
  type public."TransactionType" NOT NULL DEFAULT 'EXPENSE',
  counterpart_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS financial_auto_category_rules_counterpart_id_idx
  ON public.financial_auto_category_rules (counterpart_id);

CREATE INDEX IF NOT EXISTS financial_auto_category_rules_category_id_idx
  ON public.financial_auto_category_rules (category_id);

CREATE INDEX IF NOT EXISTS financial_auto_category_rules_is_active_idx
  ON public.financial_auto_category_rules (is_active);

CREATE UNIQUE INDEX IF NOT EXISTS financial_auto_category_rules_source_type_counterpart_id_key
  ON public.financial_auto_category_rules (source, type, counterpart_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_auto_category_rules_counterpart_id_fkey'
      AND conrelid = 'public.financial_auto_category_rules'::regclass
  ) THEN
    ALTER TABLE public.financial_auto_category_rules
      ADD CONSTRAINT financial_auto_category_rules_counterpart_id_fkey
      FOREIGN KEY (counterpart_id)
      REFERENCES public.counterparts(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_auto_category_rules_category_id_fkey'
      AND conrelid = 'public.financial_auto_category_rules'::regclass
  ) THEN
    ALTER TABLE public.financial_auto_category_rules
      ADD CONSTRAINT financial_auto_category_rules_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES public.transaction_categories(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed default rules that were previously hardcoded
INSERT INTO public.financial_auto_category_rules (
  name,
  source,
  type,
  counterpart_id,
  category_id,
  is_active,
  priority
)
SELECT
  'Paula Flores',
  'MERCADOPAGO'::public."TransactionSource",
  'EXPENSE'::public."TransactionType",
  cp.id,
  tc.id,
  TRUE,
  100
FROM public.counterparts cp
JOIN public.transaction_categories tc
  ON lower(tc.name) = lower('Paula Flores')
WHERE regexp_replace(upper(cp.identification_number), '[^0-9K]', '', 'g') = '135103934'
ON CONFLICT (source, type, counterpart_id)
DO UPDATE SET
  category_id = EXCLUDED.category_id,
  is_active = TRUE,
  priority = EXCLUDED.priority,
  name = EXCLUDED.name,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.financial_auto_category_rules (
  name,
  source,
  type,
  counterpart_id,
  category_id,
  is_active,
  priority
)
SELECT
  'Colegio',
  'MERCADOPAGO'::public."TransactionSource",
  'EXPENSE'::public."TransactionType",
  cp.id,
  tc.id,
  TRUE,
  90
FROM public.counterparts cp
JOIN public.transaction_categories tc
  ON lower(tc.name) = lower('Colegio')
WHERE regexp_replace(upper(cp.identification_number), '[^0-9K]', '', 'g') = '651477697'
ON CONFLICT (source, type, counterpart_id)
DO UPDATE SET
  category_id = EXCLUDED.category_id,
  is_active = TRUE,
  priority = EXCLUDED.priority,
  name = EXCLUDED.name,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.financial_auto_category_rules (
  name,
  source,
  type,
  counterpart_id,
  category_id,
  is_active,
  priority
)
SELECT
  'Arriendo',
  'MERCADOPAGO'::public."TransactionSource",
  'EXPENSE'::public."TransactionType",
  cp.id,
  tc.id,
  TRUE,
  80
FROM public.counterparts cp
JOIN public.transaction_categories tc
  ON lower(tc.name) = lower('Arriendo')
WHERE regexp_replace(upper(cp.identification_number), '[^0-9K]', '', 'g') = '100724820'
ON CONFLICT (source, type, counterpart_id)
DO UPDATE SET
  category_id = EXCLUDED.category_id,
  is_active = TRUE,
  priority = EXCLUDED.priority,
  name = EXCLUDED.name,
  updated_at = CURRENT_TIMESTAMP;
