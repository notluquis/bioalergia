-- Remove source from auto-category rules (always MERCADOPAGO)
-- ZenStack migration

ALTER TABLE public.financial_auto_category_rules
  DROP COLUMN IF EXISTS source;
