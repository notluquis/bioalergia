CREATE TYPE "ExpenseScope" AS ENUM ('BIOALERGIA', 'PERSONAL', 'EMPRESA');
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'SKIPPED');
CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'TEMPLATE', 'TRANSACTION');
CREATE TYPE "ExpenseRecurrence" AS ENUM ('MONTHLY', 'ONE_TIME');

CREATE TABLE "expense_services" (
  "id"             SERIAL PRIMARY KEY,
  "public_id"      TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "detail"         TEXT,
  "scope"          "ExpenseScope" NOT NULL,
  "category"       TEXT,
  "billing_day"    INTEGER,
  "due_date_rule"  TEXT,
  "default_amount" DECIMAL(14,2),
  "is_fixed"       BOOLEAN NOT NULL DEFAULT false,
  "recurrence"     "ExpenseRecurrence" NOT NULL DEFAULT 'MONTHLY',
  "start_date"     DATE,
  "end_date"       DATE,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "notes"          TEXT,
  "tags"           TEXT[] NOT NULL DEFAULT '{}',
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "expense_services_public_id_key" ON "expense_services"("public_id");
CREATE INDEX "expense_services_scope_idx" ON "expense_services"("scope");
CREATE INDEX "expense_services_is_active_idx" ON "expense_services"("is_active");

CREATE TABLE "expenses" (
  "id"               SERIAL PRIMARY KEY,
  "public_id"        TEXT NOT NULL,
  "service_id"       INTEGER REFERENCES "expense_services"("id") ON DELETE SET NULL,
  "name"             TEXT NOT NULL,
  "detail"           TEXT,
  "scope"            "ExpenseScope" NOT NULL,
  "expense_month"    TEXT NOT NULL,
  "due_date"         DATE,
  "amount_expected"  DECIMAL(14,2) NOT NULL,
  "amount_applied"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status"           "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
  "source"           "ExpenseSource" NOT NULL DEFAULT 'MANUAL',
  "category"         TEXT,
  "notes"            TEXT,
  "tags"             TEXT[] NOT NULL DEFAULT '{}',
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "expenses_public_id_key" ON "expenses"("public_id");
CREATE INDEX "expenses_expense_month_idx" ON "expenses"("expense_month");
CREATE INDEX "expenses_scope_idx" ON "expenses"("scope");
CREATE INDEX "expenses_service_id_idx" ON "expenses"("service_id");
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

CREATE TABLE "expense_transactions" (
  "id"              SERIAL PRIMARY KEY,
  "expense_id"      INTEGER NOT NULL REFERENCES "expenses"("id") ON DELETE CASCADE,
  "transaction_id"  INTEGER NOT NULL,
  "amount"          DECIMAL(14,2) NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "expense_transactions_expense_id_transaction_id_key"
  ON "expense_transactions"("expense_id", "transaction_id");
