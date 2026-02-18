-- Remove TRANSFER from TransactionType enum
-- 1) Normalize any legacy TRANSFER values
-- 2) Replace enum type with only INCOME/EXPENSE

UPDATE public.financial_transactions
SET type = CASE
  WHEN amount >= 0 THEN 'INCOME'::public."TransactionType"
  ELSE 'EXPENSE'::public."TransactionType"
END
WHERE type = 'TRANSFER'::public."TransactionType";

UPDATE public.transaction_categories
SET type = 'EXPENSE'::public."TransactionType"
WHERE type = 'TRANSFER'::public."TransactionType";

ALTER TYPE public."TransactionType" RENAME TO "TransactionType_old";

CREATE TYPE public."TransactionType" AS ENUM ('INCOME', 'EXPENSE');

ALTER TABLE public.financial_transactions
  ALTER COLUMN type TYPE public."TransactionType"
  USING (type::text::public."TransactionType");

ALTER TABLE public.transaction_categories
  ALTER COLUMN type TYPE public."TransactionType"
  USING (type::text::public."TransactionType");

DROP TYPE public."TransactionType_old";
