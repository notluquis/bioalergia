-- Add counterpart relation to financial transactions
-- ZenStack migration

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS counterpart_id INTEGER;

CREATE INDEX IF NOT EXISTS financial_transactions_counterpart_id_idx
  ON public.financial_transactions (counterpart_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_transactions_counterpart_id_fkey'
      AND conrelid = 'public.financial_transactions'::regclass
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_counterpart_id_fkey
      FOREIGN KEY (counterpart_id)
      REFERENCES public.counterparts(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
