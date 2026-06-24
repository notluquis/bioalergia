-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: expense FKs, DTE→Expense link, Loan→Counterpart, ProviderCredential, UtilityBillSnapshot
-- Generado a mano (no via zen migrate) — aplicar con: pnpm migrate:deploy
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Extend ExpenseService ──────────────────────────────────────────────
ALTER TABLE "expense_services"
  ADD COLUMN IF NOT EXISTS "emission_day"            INTEGER,
  ADD COLUMN IF NOT EXISTS "transaction_category_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "counterpart_id"          INTEGER;

CREATE INDEX IF NOT EXISTS "expense_services_transaction_category_id_idx"
  ON "expense_services" ("transaction_category_id");
CREATE INDEX IF NOT EXISTS "expense_services_counterpart_id_idx"
  ON "expense_services" ("counterpart_id");

ALTER TABLE "expense_services"
  ADD CONSTRAINT "expense_services_transaction_category_id_fkey"
  FOREIGN KEY ("transaction_category_id") REFERENCES "transaction_categories"("id") ON DELETE SET NULL;
ALTER TABLE "expense_services"
  ADD CONSTRAINT "expense_services_counterpart_id_fkey"
  FOREIGN KEY ("counterpart_id") REFERENCES "counterparts"("id") ON DELETE SET NULL;

-- ─── 2. DTEPurchaseDetail → Expense link ────────────────────────────────────
ALTER TABLE "dte_purchase_details"
  ADD COLUMN IF NOT EXISTS "expense_id"   INTEGER,
  ADD COLUMN IF NOT EXISTS "matched_at"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "match_source" TEXT;

CREATE INDEX IF NOT EXISTS "dte_purchase_details_expense_id_idx"
  ON "dte_purchase_details" ("expense_id");

ALTER TABLE "dte_purchase_details"
  ADD CONSTRAINT "dte_purchase_details_expense_id_fkey"
  FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL;

-- ─── 3. Loan → Counterpart + scope + IRREGULAR frequency ────────────────────
ALTER TYPE "LoanFrequency" ADD VALUE IF NOT EXISTS 'IRREGULAR';

ALTER TABLE "loans"
  ADD COLUMN IF NOT EXISTS "counterpart_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "scope"          "ExpenseScope" NOT NULL DEFAULT 'BIOALERGIA';

CREATE INDEX IF NOT EXISTS "loans_counterpart_id_idx"
  ON "loans" ("counterpart_id");
CREATE INDEX IF NOT EXISTS "loans_scope_idx"
  ON "loans" ("scope");

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_counterpart_id_fkey"
  FOREIGN KEY ("counterpart_id") REFERENCES "counterparts"("id") ON DELETE SET NULL;

-- ─── 4. UtilityProvider enum: agregar providers ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TELSUR'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UtilityProvider')) THEN
    ALTER TYPE "personal"."UtilityProvider" ADD VALUE 'TELSUR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MOVISTAR'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UtilityProvider')) THEN
    ALTER TYPE "personal"."UtilityProvider" ADD VALUE 'MOVISTAR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DOCTORALIA'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UtilityProvider')) THEN
    ALTER TYPE "personal"."UtilityProvider" ADD VALUE 'DOCTORALIA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MEDIPASS'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UtilityProvider')) THEN
    ALTER TYPE "personal"."UtilityProvider" ADD VALUE 'MEDIPASS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MASVIDA'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UtilityProvider')) THEN
    ALTER TYPE "personal"."UtilityProvider" ADD VALUE 'MASVIDA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PREVIRED'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UtilityProvider')) THEN
    ALTER TYPE "personal"."UtilityProvider" ADD VALUE 'PREVIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SII'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UtilityProvider')) THEN
    ALTER TYPE "personal"."UtilityProvider" ADD VALUE 'SII';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TGR'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UtilityProvider')) THEN
    ALTER TYPE "personal"."UtilityProvider" ADD VALUE 'TGR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GASTOS_COMUNES'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UtilityProvider')) THEN
    ALTER TYPE "personal"."UtilityProvider" ADD VALUE 'GASTOS_COMUNES';
  END IF;
END$$;

-- ─── 5. ProviderAuthMethod enum (nuevo) ──────────────────────────────────────
CREATE TYPE "personal"."ProviderAuthMethod" AS ENUM (
  'NONE_PUBLIC',
  'RUT_PASSWORD',
  'CLAVE_UNICA',
  'CLAVE_TRIBUTARIA',
  'OAUTH',
  'API_KEY',
  'EMAIL_FORWARDING'
);

-- ─── 6. ProviderCredential ──────────────────────────────────────────────────
CREATE TABLE "personal"."provider_credentials" (
  "id"                SERIAL              PRIMARY KEY,
  "provider"          "personal"."UtilityProvider" NOT NULL,
  "scope"             "ExpenseScope"      NOT NULL DEFAULT 'PERSONAL',
  "auth_method"       "personal"."ProviderAuthMethod" NOT NULL DEFAULT 'RUT_PASSWORD',
  "label"             TEXT,
  "identifier"        TEXT                NOT NULL,
  "secret_encrypted"  TEXT                NOT NULL,
  "metadata"          JSONB,
  "is_active"         BOOLEAN             NOT NULL DEFAULT true,
  "last_login_at"     TIMESTAMP(3),
  "last_error_at"     TIMESTAMP(3),
  "last_error"        TEXT,
  "notes"             TEXT,
  "created_at"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "provider_credentials_provider_identifier_idx"
  ON "personal"."provider_credentials" ("provider", "identifier");
CREATE INDEX "provider_credentials_provider_idx"
  ON "personal"."provider_credentials" ("provider");

-- ─── 7. UtilityAccount.credential_id ────────────────────────────────────────
ALTER TABLE "personal"."utility_accounts"
  ADD COLUMN IF NOT EXISTS "credential_id" INTEGER;

CREATE INDEX IF NOT EXISTS "utility_accounts_credential_id_idx"
  ON "personal"."utility_accounts" ("credential_id");

ALTER TABLE "personal"."utility_accounts"
  ADD CONSTRAINT "utility_accounts_credential_id_fkey"
  FOREIGN KEY ("credential_id") REFERENCES "personal"."provider_credentials"("id") ON DELETE SET NULL;

-- ─── 8. UtilityBillSnapshot ──────────────────────────────────────────────────
CREATE TABLE "personal"."utility_bill_snapshots" (
  "id"                BIGSERIAL           PRIMARY KEY,
  "utility_account_id" INTEGER            NOT NULL,
  "fetched_at"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source"            TEXT                NOT NULL DEFAULT 'MANUAL',
  "current_amount"    DECIMAL(15, 2),
  "previous_amount"   DECIMAL(15, 2),
  "third_amount"      DECIMAL(15, 2),
  "current_debt"      DECIMAL(15, 2),
  "emission_date"     TEXT,
  "due_date"          TEXT,
  "last_payment_json" JSONB,
  "observation"       TEXT,
  "raw_response"      JSONB               NOT NULL,
  "error_message"     TEXT
);

CREATE INDEX "utility_bill_snapshots_account_fetched_idx"
  ON "personal"."utility_bill_snapshots" ("utility_account_id", "fetched_at");

ALTER TABLE "personal"."utility_bill_snapshots"
  ADD CONSTRAINT "utility_bill_snapshots_utility_account_id_fkey"
  FOREIGN KEY ("utility_account_id") REFERENCES "personal"."utility_accounts"("id") ON DELETE CASCADE;
