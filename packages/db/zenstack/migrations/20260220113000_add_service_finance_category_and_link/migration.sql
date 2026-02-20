-- Link services with finance categories and financial transactions

ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "transaction_category_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "reminder_days_before" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "auto_link_transactions" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "services_transaction_category_id_idx"
  ON "services"("transaction_category_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_transaction_category_id_fkey'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_transaction_category_id_fkey"
      FOREIGN KEY ("transaction_category_id")
      REFERENCES "transaction_categories"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "service_schedules"
  ADD COLUMN IF NOT EXISTS "financial_transaction_id" INTEGER;

CREATE INDEX IF NOT EXISTS "service_schedules_financial_transaction_id_idx"
  ON "service_schedules"("financial_transaction_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_schedules_financial_transaction_id_fkey'
  ) THEN
    ALTER TABLE "service_schedules"
      ADD CONSTRAINT "service_schedules_financial_transaction_id_fkey"
      FOREIGN KEY ("financial_transaction_id")
      REFERENCES "financial_transactions"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
