-- Add minimal recurring-service model:
-- 1) extend services metadata
-- 2) add service_schedules table (monthly installments/cells)

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "ServiceRecurrenceType" AS ENUM ('RECURRING', 'ONE_OFF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceOwnership" AS ENUM ('COMPANY', 'OWNER', 'MIXED', 'THIRD_PARTY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceObligationType" AS ENUM ('SERVICE', 'DEBT', 'LOAN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceAmountIndexation" AS ENUM ('NONE', 'UF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceLateFeeMode" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceEmissionMode" AS ENUM ('FIXED_DAY', 'DATE_RANGE', 'SPECIFIC_DATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceScheduleStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SERVICES TABLE EXTENSION
-- ============================================================
ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "public_id" TEXT,
  ADD COLUMN IF NOT EXISTS "detail" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "recurrence_type" "ServiceRecurrenceType",
  ADD COLUMN IF NOT EXISTS "start_date" DATE,
  ADD COLUMN IF NOT EXISTS "end_date" DATE,
  ADD COLUMN IF NOT EXISTS "due_day" INTEGER,
  ADD COLUMN IF NOT EXISTS "emission_mode" "ServiceEmissionMode",
  ADD COLUMN IF NOT EXISTS "emission_day" INTEGER,
  ADD COLUMN IF NOT EXISTS "emission_start_day" INTEGER,
  ADD COLUMN IF NOT EXISTS "emission_end_day" INTEGER,
  ADD COLUMN IF NOT EXISTS "emission_exact_date" DATE,
  ADD COLUMN IF NOT EXISTS "ownership" "ServiceOwnership",
  ADD COLUMN IF NOT EXISTS "obligation_type" "ServiceObligationType",
  ADD COLUMN IF NOT EXISTS "amount_indexation" "ServiceAmountIndexation",
  ADD COLUMN IF NOT EXISTS "late_fee_mode" "ServiceLateFeeMode",
  ADD COLUMN IF NOT EXISTS "late_fee_value" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "late_fee_grace_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "next_generation_months" INTEGER,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Backfill for existing rows
UPDATE "services"
SET
  "public_id" = COALESCE("public_id", 'srv_' || "id"::text),
  "start_date" = COALESCE("start_date", "created_at"::date, CURRENT_DATE),
  "recurrence_type" = COALESCE("recurrence_type", 'RECURRING'::"ServiceRecurrenceType"),
  "emission_mode" = COALESCE("emission_mode", 'FIXED_DAY'::"ServiceEmissionMode"),
  "ownership" = COALESCE("ownership", 'COMPANY'::"ServiceOwnership"),
  "obligation_type" = COALESCE("obligation_type", 'SERVICE'::"ServiceObligationType"),
  "amount_indexation" = COALESCE("amount_indexation", 'NONE'::"ServiceAmountIndexation"),
  "late_fee_mode" = COALESCE("late_fee_mode", 'NONE'::"ServiceLateFeeMode"),
  "next_generation_months" = COALESCE("next_generation_months", 12);

ALTER TABLE "services"
  ALTER COLUMN "public_id" SET NOT NULL,
  ALTER COLUMN "start_date" SET NOT NULL,
  ALTER COLUMN "recurrence_type" SET NOT NULL,
  ALTER COLUMN "emission_mode" SET NOT NULL,
  ALTER COLUMN "ownership" SET NOT NULL,
  ALTER COLUMN "obligation_type" SET NOT NULL,
  ALTER COLUMN "amount_indexation" SET NOT NULL,
  ALTER COLUMN "late_fee_mode" SET NOT NULL,
  ALTER COLUMN "next_generation_months" SET NOT NULL,
  ALTER COLUMN "recurrence_type" SET DEFAULT 'RECURRING',
  ALTER COLUMN "emission_mode" SET DEFAULT 'FIXED_DAY',
  ALTER COLUMN "ownership" SET DEFAULT 'COMPANY',
  ALTER COLUMN "obligation_type" SET DEFAULT 'SERVICE',
  ALTER COLUMN "amount_indexation" SET DEFAULT 'NONE',
  ALTER COLUMN "late_fee_mode" SET DEFAULT 'NONE',
  ALTER COLUMN "next_generation_months" SET DEFAULT 12;

CREATE UNIQUE INDEX IF NOT EXISTS "services_public_id_key"
  ON "services"("public_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_due_day_between_1_31_chk'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_due_day_between_1_31_chk"
      CHECK ("due_day" IS NULL OR ("due_day" BETWEEN 1 AND 31));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_emission_day_between_1_31_chk'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_emission_day_between_1_31_chk"
      CHECK ("emission_day" IS NULL OR ("emission_day" BETWEEN 1 AND 31));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_emission_start_day_between_1_31_chk'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_emission_start_day_between_1_31_chk"
      CHECK ("emission_start_day" IS NULL OR ("emission_start_day" BETWEEN 1 AND 31));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_emission_end_day_between_1_31_chk'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_emission_end_day_between_1_31_chk"
      CHECK ("emission_end_day" IS NULL OR ("emission_end_day" BETWEEN 1 AND 31));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_generation_months_positive_chk'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_generation_months_positive_chk"
      CHECK ("next_generation_months" > 0);
  END IF;
END $$;

-- ============================================================
-- SERVICE SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS "service_schedules" (
  "id" SERIAL NOT NULL,
  "service_id" INTEGER NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "expected_amount" DECIMAL(15,2) NOT NULL,
  "late_fee_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "effective_amount" DECIMAL(15,2) NOT NULL,
  "status" "ServiceScheduleStatus" NOT NULL DEFAULT 'PENDING',
  "paid_amount" DECIMAL(15,2),
  "paid_date" TIMESTAMP(3),
  "settlement_transaction_id" INTEGER,
  "release_transaction_id" INTEGER,
  "withdraw_transaction_id" INTEGER,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "service_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_schedules_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "service_schedules_settlement_transaction_id_fkey"
    FOREIGN KEY ("settlement_transaction_id") REFERENCES "settlement_transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "service_schedules_release_transaction_id_fkey"
    FOREIGN KEY ("release_transaction_id") REFERENCES "release_transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "service_schedules_withdraw_transaction_id_fkey"
    FOREIGN KEY ("withdraw_transaction_id") REFERENCES "withdraw_transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_schedules_service_id_period_start_key"
  ON "service_schedules"("service_id", "period_start");

CREATE INDEX IF NOT EXISTS "service_schedules_service_id_due_date_idx"
  ON "service_schedules"("service_id", "due_date");

CREATE INDEX IF NOT EXISTS "service_schedules_status_due_date_idx"
  ON "service_schedules"("status", "due_date");

CREATE INDEX IF NOT EXISTS "service_schedules_settlement_transaction_id_idx"
  ON "service_schedules"("settlement_transaction_id");

CREATE INDEX IF NOT EXISTS "service_schedules_release_transaction_id_idx"
  ON "service_schedules"("release_transaction_id");

CREATE INDEX IF NOT EXISTS "service_schedules_withdraw_transaction_id_idx"
  ON "service_schedules"("withdraw_transaction_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_schedules_period_order_chk'
  ) THEN
    ALTER TABLE "service_schedules"
      ADD CONSTRAINT "service_schedules_period_order_chk"
      CHECK ("period_end" >= "period_start");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_schedules_single_transaction_link_chk'
  ) THEN
    ALTER TABLE "service_schedules"
      ADD CONSTRAINT "service_schedules_single_transaction_link_chk"
      CHECK (
        (CASE WHEN "settlement_transaction_id" IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN "release_transaction_id" IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN "withdraw_transaction_id" IS NULL THEN 0 ELSE 1 END)
        <= 1
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_schedules_amounts_non_negative_chk'
  ) THEN
    ALTER TABLE "service_schedules"
      ADD CONSTRAINT "service_schedules_amounts_non_negative_chk"
      CHECK (
        "expected_amount" >= 0
        AND "late_fee_amount" >= 0
        AND "effective_amount" >= 0
        AND ("paid_amount" IS NULL OR "paid_amount" >= 0)
      );
  END IF;
END $$;
