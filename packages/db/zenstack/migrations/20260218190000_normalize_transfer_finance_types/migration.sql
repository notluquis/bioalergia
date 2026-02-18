-- Normalize legacy TRANSFER types in finance domain
-- Keep enum value for backward compatibility, but remove its usage in app flows.

UPDATE public.financial_transactions
SET type = CASE
  WHEN amount >= 0 THEN 'INCOME'::public."TransactionType"
  ELSE 'EXPENSE'::public."TransactionType"
END
WHERE type = 'TRANSFER'::public."TransactionType";

UPDATE public.transaction_categories
SET type = 'EXPENSE'::public."TransactionType"
WHERE type = 'TRANSFER'::public."TransactionType";
