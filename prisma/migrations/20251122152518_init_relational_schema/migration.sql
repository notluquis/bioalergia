/*
  Warnings:

  - You are about to drop the `google_calendar_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `google_calendar_sync_log` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('GOD', 'ADMIN', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "CounterpartPersonType" AS ENUM ('PERSON', 'COMPANY', 'OTHER');

-- CreateEnum
CREATE TYPE "CounterpartCategory" AS ENUM ('SUPPLIER', 'PATIENT', 'EMPLOYEE', 'PARTNER', 'RELATED', 'OTHER', 'CLIENT', 'LENDER');

-- CreateEnum
CREATE TYPE "LoanInterestType" AS ENUM ('SIMPLE', 'COMPOUND');

-- CreateEnum
CREATE TYPE "LoanFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "LoanScheduleStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('BUSINESS', 'PERSONAL', 'SUPPLIER', 'TAX', 'UTILITY', 'LEASE', 'SOFTWARE', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceOwnership" AS ENUM ('COMPANY', 'OWNER', 'MIXED', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "ServiceObligationType" AS ENUM ('SERVICE', 'DEBT', 'LOAN', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceRecurrenceType" AS ENUM ('RECURRING', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "ServiceFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'ONCE');

-- CreateEnum
CREATE TYPE "ServiceAmountIndexation" AS ENUM ('NONE', 'UF');

-- CreateEnum
CREATE TYPE "ServiceEmissionMode" AS ENUM ('FIXED_DAY', 'DATE_RANGE', 'SPECIFIC_DATE');

-- CreateEnum
CREATE TYPE "ServiceLateFeeMode" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ServiceScheduleStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MonthlyExpenseSource" AS ENUM ('MANUAL', 'TRANSACTION', 'SERVICE');

-- CreateEnum
CREATE TYPE "MonthlyExpenseStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('IN', 'OUT', 'NEUTRO');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "EmployeeSalaryType" AS ENUM ('hourly', 'fixed');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SupplyRequestStatus" AS ENUM ('pending', 'ordered', 'in_transit', 'delivered', 'rejected');

-- DropTable
DROP TABLE "google_calendar_events";

-- DropTable
DROP TABLE "google_calendar_sync_log";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "config_key" VARCHAR(128) NOT NULL,
    "config_value" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("config_key")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "rut" VARCHAR(20),
    "bank_name" TEXT,
    "bank_account_type" TEXT,
    "bank_account_number" TEXT,
    "salary_type" "EmployeeSalaryType" NOT NULL DEFAULT 'hourly',
    "hourly_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fixed_salary" DECIMAL(12,2),
    "overtime_rate" DECIMAL(10,2),
    "retention_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_timesheets" (
    "id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "start_time" TIME,
    "end_time" TIME,
    "worked_minutes" INTEGER NOT NULL,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "extra_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_counterparts" (
    "id" SERIAL NOT NULL,
    "rut" TEXT,
    "name" TEXT NOT NULL,
    "person_type" "CounterpartPersonType" NOT NULL DEFAULT 'OTHER',
    "category" "CounterpartCategory" NOT NULL DEFAULT 'SUPPLIER',
    "employee_id" INTEGER,
    "email" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_counterparts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_counterpart_accounts" (
    "id" SERIAL NOT NULL,
    "counterpart_id" INTEGER NOT NULL,
    "account_identifier" TEXT NOT NULL,
    "bank_name" TEXT,
    "account_type" TEXT,
    "holder" TEXT,
    "concept" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_counterpart_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_transactions" (
    "id" SERIAL NOT NULL,
    "timestamp_raw" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "source_id" TEXT,
    "direction" "TransactionDirection" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "raw_json" TEXT,
    "source_file" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_withdrawals" (
    "withdraw_id" TEXT NOT NULL,
    "date_created" TIMESTAMP(3),
    "status" TEXT,
    "status_detail" TEXT,
    "amount" DECIMAL(15,2),
    "fee" DECIMAL(15,2),
    "activity_url" TEXT,
    "payout_desc" TEXT,
    "bank_account_holder" TEXT,
    "identification_type" TEXT,
    "identification_number" TEXT,
    "bank_id" TEXT,
    "bank_name" TEXT,
    "bank_branch" TEXT,
    "bank_account_type" TEXT,
    "bank_account_number" TEXT,
    "raw_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_withdrawals_pkey" PRIMARY KEY ("withdraw_id")
);

-- CreateTable
CREATE TABLE "mp_daily_balances" (
    "balance_date" DATE NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_daily_balances_pkey" PRIMARY KEY ("balance_date")
);

-- CreateTable
CREATE TABLE "mp_daily_production_balances" (
    "id" BIGSERIAL NOT NULL,
    "balance_date" DATE NOT NULL,
    "ingreso_tarjetas" INTEGER NOT NULL DEFAULT 0,
    "ingreso_transferencias" INTEGER NOT NULL DEFAULT 0,
    "ingreso_efectivo" INTEGER NOT NULL DEFAULT 0,
    "subtotal_ingresos" INTEGER NOT NULL DEFAULT 0,
    "gastos_diarios" INTEGER NOT NULL DEFAULT 0,
    "total_ingresos" INTEGER NOT NULL DEFAULT 0,
    "consultas_count" INTEGER NOT NULL DEFAULT 0,
    "controles_count" INTEGER NOT NULL DEFAULT 0,
    "tests_count" INTEGER NOT NULL DEFAULT 0,
    "vacunas_count" INTEGER NOT NULL DEFAULT 0,
    "licencias_count" INTEGER NOT NULL DEFAULT 0,
    "roxair_count" INTEGER NOT NULL DEFAULT 0,
    "otros_abonos" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "comentarios" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_daily_production_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_daily_production_balance_history" (
    "id" BIGSERIAL NOT NULL,
    "balance_id" BIGINT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "change_reason" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_daily_production_balance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "borrower_name" TEXT NOT NULL,
    "borrower_type" TEXT NOT NULL DEFAULT 'PERSON',
    "principal_amount" DECIMAL(15,2) NOT NULL,
    "interest_rate" DECIMAL(9,6) NOT NULL,
    "interest_type" "LoanInterestType" NOT NULL DEFAULT 'SIMPLE',
    "frequency" "LoanFrequency" NOT NULL,
    "total_installments" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_schedules" (
    "id" SERIAL NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "expected_amount" DECIMAL(15,2) NOT NULL,
    "expected_principal" DECIMAL(15,2) NOT NULL,
    "expected_interest" DECIMAL(15,2) NOT NULL,
    "status" "LoanScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" INTEGER,
    "paid_amount" DECIMAL(15,2),
    "paid_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "category" TEXT,
    "service_type" "ServiceType" NOT NULL DEFAULT 'BUSINESS',
    "ownership" "ServiceOwnership" NOT NULL DEFAULT 'COMPANY',
    "obligation_type" "ServiceObligationType" NOT NULL DEFAULT 'SERVICE',
    "recurrence_type" "ServiceRecurrenceType" NOT NULL DEFAULT 'RECURRING',
    "frequency" "ServiceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "default_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount_indexation" "ServiceAmountIndexation" NOT NULL DEFAULT 'NONE',
    "counterpart_id" INTEGER,
    "counterpart_account_id" INTEGER,
    "account_reference" TEXT,
    "emission_day" SMALLINT,
    "emission_mode" "ServiceEmissionMode" NOT NULL DEFAULT 'FIXED_DAY',
    "emission_start_day" SMALLINT,
    "emission_end_day" SMALLINT,
    "emission_exact_date" DATE,
    "due_day" SMALLINT,
    "start_date" DATE NOT NULL DEFAULT '1970-01-01',
    "next_generation_months" INTEGER NOT NULL DEFAULT 12,
    "late_fee_mode" "ServiceLateFeeMode" NOT NULL DEFAULT 'NONE',
    "late_fee_value" DECIMAL(15,2),
    "late_fee_grace_days" SMALLINT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_schedules" (
    "id" SERIAL NOT NULL,
    "service_id" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "expected_amount" DECIMAL(15,2) NOT NULL,
    "status" "ServiceScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" INTEGER,
    "paid_amount" DECIMAL(15,2),
    "paid_date" DATE,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_expenses" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "amount_expected" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expense_date" DATE NOT NULL,
    "notes" TEXT,
    "source" "MonthlyExpenseSource" NOT NULL DEFAULT 'MANUAL',
    "service_id" INTEGER,
    "tags" JSONB,
    "status" "MonthlyExpenseStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_expense_transactions" (
    "id" SERIAL NOT NULL,
    "monthly_expense_id" INTEGER NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_expense_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_mappings" (
    "employee_role" TEXT NOT NULL,
    "app_role" "UserRole" NOT NULL,

    CONSTRAINT "role_mappings_pkey" PRIMARY KEY ("employee_role")
);

-- CreateTable
CREATE TABLE "common_supplies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "common_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_requests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "supply_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "notes" TEXT,
    "status" "SupplyRequestStatus" NOT NULL DEFAULT 'pending',
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "id" SERIAL NOT NULL,
    "google_id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "calendar_id" INTEGER NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "event_status" TEXT,
    "event_type" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "start_date" DATE,
    "start_date_time" TIMESTAMP(3),
    "start_time_zone" TEXT,
    "end_date" DATE,
    "end_date_time" TIMESTAMP(3),
    "end_time_zone" TEXT,
    "event_created_at" TIMESTAMP(3),
    "event_updated_at" TIMESTAMP(3),
    "color_id" TEXT,
    "location" TEXT,
    "transparency" TEXT,
    "visibility" TEXT,
    "hangout_link" TEXT,
    "category" TEXT,
    "amount_expected" INTEGER,
    "amount_paid" INTEGER,
    "attended" BOOLEAN,
    "dosage" TEXT,
    "treatment_stage" TEXT,
    "raw_event" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" BIGSERIAL NOT NULL,
    "trigger_source" TEXT NOT NULL,
    "trigger_user_id" INTEGER,
    "trigger_label" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'SUCCESS',
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3),
    "inserted" INTEGER DEFAULT 0,
    "updated" INTEGER DEFAULT 0,
    "skipped" INTEGER DEFAULT 0,
    "excluded" INTEGER DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_employee_day" ON "employee_timesheets"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "mp_counterparts_rut_key" ON "mp_counterparts"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "mp_counterpart_accounts_account_identifier_key" ON "mp_counterpart_accounts"("account_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_movement" ON "mp_transactions"("timestamp_raw", "direction", "amount", "origin", "destination", "source_file");

-- CreateIndex
CREATE UNIQUE INDEX "loans_public_id_key" ON "loans"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_schedule_installment" ON "loan_schedules"("loan_id", "installment_number");

-- CreateIndex
CREATE UNIQUE INDEX "services_public_id_key" ON "services"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_service_period" ON "service_schedules"("service_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_expenses_public_id_key" ON "monthly_expenses"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_expense_transaction" ON "monthly_expense_transactions"("monthly_expense_id", "transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "common_supplies_name_key" ON "common_supplies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "calendars_google_id_key" ON "calendars"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_calendar_id_external_event_id_key" ON "events"("calendar_id", "external_event_id");

-- AddForeignKey
ALTER TABLE "employee_timesheets" ADD CONSTRAINT "employee_timesheets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mp_counterparts" ADD CONSTRAINT "mp_counterparts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mp_counterpart_accounts" ADD CONSTRAINT "mp_counterpart_accounts_counterpart_id_fkey" FOREIGN KEY ("counterpart_id") REFERENCES "mp_counterparts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mp_daily_production_balances" ADD CONSTRAINT "mp_daily_production_balances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mp_daily_production_balances" ADD CONSTRAINT "mp_daily_production_balances_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mp_daily_production_balance_history" ADD CONSTRAINT "mp_daily_production_balance_history_balance_id_fkey" FOREIGN KEY ("balance_id") REFERENCES "mp_daily_production_balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mp_daily_production_balance_history" ADD CONSTRAINT "mp_daily_production_balance_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_schedules" ADD CONSTRAINT "loan_schedules_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_schedules" ADD CONSTRAINT "loan_schedules_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "mp_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_counterpart_id_fkey" FOREIGN KEY ("counterpart_id") REFERENCES "mp_counterparts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_counterpart_account_id_fkey" FOREIGN KEY ("counterpart_account_id") REFERENCES "mp_counterpart_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_schedules" ADD CONSTRAINT "service_schedules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_schedules" ADD CONSTRAINT "service_schedules_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "mp_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_expenses" ADD CONSTRAINT "monthly_expenses_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_expense_transactions" ADD CONSTRAINT "monthly_expense_transactions_monthly_expense_id_fkey" FOREIGN KEY ("monthly_expense_id") REFERENCES "monthly_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_expense_transactions" ADD CONSTRAINT "monthly_expense_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "mp_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
