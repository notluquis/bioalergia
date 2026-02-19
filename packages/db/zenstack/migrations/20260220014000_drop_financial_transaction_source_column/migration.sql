-- Drop source from financial transactions (single-source system: MercadoPago)
-- ZenStack migration

ALTER TABLE public.financial_transactions
  DROP COLUMN IF EXISTS source;

DROP TYPE IF EXISTS public."TransactionSource";
