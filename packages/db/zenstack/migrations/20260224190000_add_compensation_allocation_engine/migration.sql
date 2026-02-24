-- Compensation allocation engine for salary carryover by period

DO $$ BEGIN
  CREATE TYPE "CompensationAllocationType" AS ENUM (
    'ORIGINAL',
    'ROLLOVER_OUT',
    'ROLLOVER_IN',
    'MANUAL_ADJUST'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "compensation_profiles" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category_id" INTEGER NOT NULL,
  "counterpart_id" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "timezone" TEXT NOT NULL DEFAULT 'America/Santiago',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "compensation_profiles_category_id_idx"
  ON "compensation_profiles"("category_id");
CREATE INDEX IF NOT EXISTS "compensation_profiles_counterpart_id_idx"
  ON "compensation_profiles"("counterpart_id");
CREATE INDEX IF NOT EXISTS "compensation_profiles_is_active_idx"
  ON "compensation_profiles"("is_active");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'compensation_profiles_category_id_fkey'
  ) THEN
    ALTER TABLE "compensation_profiles"
      ADD CONSTRAINT "compensation_profiles_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'compensation_profiles_counterpart_id_fkey'
  ) THEN
    ALTER TABLE "compensation_profiles"
      ADD CONSTRAINT "compensation_profiles_counterpart_id_fkey"
      FOREIGN KEY ("counterpart_id") REFERENCES "counterparts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "compensation_period_budgets" (
  "id" SERIAL PRIMARY KEY,
  "profile_id" INTEGER NOT NULL,
  "period" VARCHAR(7) NOT NULL,
  "base_amount" DECIMAL(19,4) NOT NULL,
  "is_locked" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compensation_period_budgets_period_format_chk"
    CHECK ("period" ~ '^\\d{4}-\\d{2}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "compensation_period_budgets_profile_id_period_key"
  ON "compensation_period_budgets"("profile_id", "period");
CREATE INDEX IF NOT EXISTS "compensation_period_budgets_profile_id_idx"
  ON "compensation_period_budgets"("profile_id");
CREATE INDEX IF NOT EXISTS "compensation_period_budgets_period_idx"
  ON "compensation_period_budgets"("period");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'compensation_period_budgets_profile_id_fkey'
  ) THEN
    ALTER TABLE "compensation_period_budgets"
      ADD CONSTRAINT "compensation_period_budgets_profile_id_fkey"
      FOREIGN KEY ("profile_id") REFERENCES "compensation_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "financial_transaction_allocations" (
  "id" SERIAL PRIMARY KEY,
  "transaction_id" INTEGER NOT NULL,
  "profile_id" INTEGER NOT NULL,
  "period" VARCHAR(7) NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "allocation_type" "CompensationAllocationType" NOT NULL DEFAULT 'MANUAL_ADJUST',
  "source_allocation_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_transaction_allocations_period_format_chk"
    CHECK ("period" ~ '^\\d{4}-\\d{2}$'),
  CONSTRAINT "financial_transaction_allocations_amount_positive_chk"
    CHECK ("amount" > 0)
);

CREATE INDEX IF NOT EXISTS "financial_transaction_allocations_transaction_id_idx"
  ON "financial_transaction_allocations"("transaction_id");
CREATE INDEX IF NOT EXISTS "financial_transaction_allocations_profile_id_idx"
  ON "financial_transaction_allocations"("profile_id");
CREATE INDEX IF NOT EXISTS "financial_transaction_allocations_period_idx"
  ON "financial_transaction_allocations"("period");
CREATE INDEX IF NOT EXISTS "financial_transaction_allocations_source_allocation_id_idx"
  ON "financial_transaction_allocations"("source_allocation_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financial_transaction_allocations_transaction_id_fkey'
  ) THEN
    ALTER TABLE "financial_transaction_allocations"
      ADD CONSTRAINT "financial_transaction_allocations_transaction_id_fkey"
      FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financial_transaction_allocations_profile_id_fkey'
  ) THEN
    ALTER TABLE "financial_transaction_allocations"
      ADD CONSTRAINT "financial_transaction_allocations_profile_id_fkey"
      FOREIGN KEY ("profile_id") REFERENCES "compensation_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financial_transaction_allocations_source_allocation_id_fkey'
  ) THEN
    ALTER TABLE "financial_transaction_allocations"
      ADD CONSTRAINT "financial_transaction_allocations_source_allocation_id_fkey"
      FOREIGN KEY ("source_allocation_id") REFERENCES "financial_transaction_allocations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
