DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanBorrowerType') THEN
    CREATE TYPE "LoanBorrowerType" AS ENUM ('PERSON', 'COMPANY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanFrequency') THEN
    CREATE TYPE "LoanFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanInterestType') THEN
    CREATE TYPE "LoanInterestType" AS ENUM ('SIMPLE', 'COMPOUND');
  END IF;
END $$;

ALTER TYPE "LoanScheduleStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

ALTER TABLE "loans"
  ADD COLUMN IF NOT EXISTS "public_id" TEXT,
  ADD COLUMN IF NOT EXISTS "borrower_name" TEXT,
  ADD COLUMN IF NOT EXISTS "borrower_type" "LoanBorrowerType",
  ADD COLUMN IF NOT EXISTS "interest_type" "LoanInterestType",
  ADD COLUMN IF NOT EXISTS "frequency" "LoanFrequency",
  ADD COLUMN IF NOT EXISTS "total_installments" INTEGER,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

UPDATE "loans"
SET
  "public_id" = COALESCE("public_id", 'loan_' || "id"::text),
  "borrower_name" = COALESCE(NULLIF("borrower_name", ''), NULLIF("title", ''), 'Sin beneficiario'),
  "borrower_type" = COALESCE("borrower_type", 'PERSON'::"LoanBorrowerType"),
  "interest_type" = COALESCE("interest_type", 'SIMPLE'::"LoanInterestType"),
  "frequency" = COALESCE("frequency", 'MONTHLY'::"LoanFrequency"),
  "total_installments" = COALESCE(
    "total_installments",
    GREATEST(
      1,
      COALESCE((SELECT COUNT(*)::INTEGER FROM "loan_schedules" ls WHERE ls."loan_id" = "loans"."id"), 0)
    )
  );

ALTER TABLE "loans"
  ALTER COLUMN "public_id" SET NOT NULL,
  ALTER COLUMN "borrower_name" SET NOT NULL,
  ALTER COLUMN "borrower_type" SET NOT NULL,
  ALTER COLUMN "interest_type" SET NOT NULL,
  ALTER COLUMN "frequency" SET NOT NULL,
  ALTER COLUMN "total_installments" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "loans_public_id_key" ON "loans"("public_id");

ALTER TABLE "loan_schedules"
  ADD COLUMN IF NOT EXISTS "expected_principal" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "expected_interest" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "paid_amount" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "paid_date" DATE,
  ADD COLUMN IF NOT EXISTS "transaction_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "note" TEXT,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

UPDATE "loan_schedules"
SET
  "expected_principal" = COALESCE("expected_principal", "expected_amount"),
  "expected_interest" = COALESCE("expected_interest", 0),
  "created_at" = COALESCE("created_at", NOW()),
  "updated_at" = COALESCE("updated_at", NOW());

ALTER TABLE "loan_schedules"
  ALTER COLUMN "expected_principal" SET NOT NULL,
  ALTER COLUMN "expected_interest" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "loan_schedules_transaction_id_idx"
  ON "loan_schedules"("transaction_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_schedules_transaction_id_fkey'
  ) THEN
    ALTER TABLE "loan_schedules"
      ADD CONSTRAINT "loan_schedules_transaction_id_fkey"
      FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
