CREATE TYPE "LoanSourceType" AS ENUM (
  'BANK_CREDIT',
  'CREDIT_CARD',
  'PERSON_LOAN',
  'TRANSFER',
  'OTHER'
);

CREATE TYPE "LoanSchedulePaymentKind" AS ENUM (
  'PAYMENT',
  'DISCOUNT',
  'ADJUSTMENT'
);

CREATE TABLE "loan_sources" (
  "id" SERIAL PRIMARY KEY,
  "loan_id" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "source_type" "LoanSourceType" NOT NULL DEFAULT 'OTHER',
  "principal_amount" DECIMAL(15, 2) NOT NULL,
  "fixed_interest_rate" DECIMAL(9, 6) NOT NULL DEFAULT 0,
  "interest_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "fee_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(15, 2) NOT NULL,
  "disbursement_date" DATE,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_sources_loan_id_fkey"
    FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "loan_schedule_payments" (
  "id" SERIAL PRIMARY KEY,
  "schedule_id" INTEGER NOT NULL,
  "amount" DECIMAL(15, 2) NOT NULL,
  "paid_date" DATE NOT NULL,
  "kind" "LoanSchedulePaymentKind" NOT NULL DEFAULT 'PAYMENT',
  "transaction_id" INTEGER,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_schedule_payments_schedule_id_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "loan_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "loan_schedule_payments_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "loan_sources_loan_id_idx" ON "loan_sources"("loan_id");
CREATE INDEX "loan_schedule_payments_schedule_id_idx" ON "loan_schedule_payments"("schedule_id");
CREATE INDEX "loan_schedule_payments_transaction_id_idx" ON "loan_schedule_payments"("transaction_id");
