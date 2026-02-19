-- Restrict TransactionSource enum to MERCADOPAGO only
-- ZenStack migration

-- Normalize any legacy values before type rewrite
UPDATE public.financial_transactions
SET source = 'MERCADOPAGO'::"TransactionSource"
WHERE source <> 'MERCADOPAGO'::"TransactionSource";

-- Recreate enum because PostgreSQL doesn't support removing enum values safely across versions
ALTER TABLE public.financial_transactions
  ALTER COLUMN source DROP DEFAULT;

ALTER TABLE public.financial_transactions
  ALTER COLUMN source TYPE TEXT
  USING source::TEXT;

DROP TYPE IF EXISTS public."TransactionSource";

CREATE TYPE public."TransactionSource" AS ENUM ('MERCADOPAGO');

ALTER TABLE public.financial_transactions
  ALTER COLUMN source TYPE public."TransactionSource"
  USING source::public."TransactionSource";

ALTER TABLE public.financial_transactions
  ALTER COLUMN source SET DEFAULT 'MERCADOPAGO'::public."TransactionSource";
