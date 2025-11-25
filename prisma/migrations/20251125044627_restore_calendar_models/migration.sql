-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('GOD', 'ADMIN', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('NATURAL', 'JURIDICAL');

-- CreateEnum
CREATE TYPE "CounterpartCategory" AS ENUM ('SUPPLIER', 'PATIENT', 'EMPLOYEE', 'PARTNER', 'RELATED', 'OTHER', 'CLIENT', 'LENDER', 'OCCASIONAL');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "EmployeeSalaryType" AS ENUM ('HOURLY', 'FIXED');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('IN', 'OUT', 'NEUTRO');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('BUSINESS', 'PERSONAL', 'SUPPLIER', 'TAX', 'UTILITY', 'LEASE', 'SOFTWARE', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'ONCE');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "LoanScheduleStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_SETUP', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "people" (
    "id" SERIAL NOT NULL,
    "rut" VARCHAR(20) NOT NULL,
    "names" TEXT NOT NULL,
    "father_name" TEXT,
    "mother_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "person_type" "PersonType" NOT NULL DEFAULT 'NATURAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "passkey_credential_id" TEXT,
    "passkey_public_key" BYTEA,
    "passkey_counter" BIGINT NOT NULL DEFAULT 0,
    "passkey_transports" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "salary_type" "EmployeeSalaryType" NOT NULL DEFAULT 'FIXED',
    "base_salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hourly_rate" DECIMAL(10,2),
    "bank_name" TEXT,
    "bank_account_type" TEXT,
    "bank_account_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counterparts" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "category" "CounterpartCategory" NOT NULL DEFAULT 'SUPPLIER',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counterparts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counterpart_accounts" (
    "id" SERIAL NOT NULL,
    "counterpart_id" INTEGER NOT NULL,
    "bank_name" TEXT,
    "account_type" TEXT,
    "account_number" TEXT NOT NULL,

    CONSTRAINT "counterpart_accounts_pkey" PRIMARY KEY ("id")
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
    "comment" TEXT,

    CONSTRAINT "employee_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "person_id" INTEGER,
    "origin" TEXT,
    "destination" TEXT,
    "source_file" TEXT,
    "raw_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "counterpart_id" INTEGER,
    "type" "ServiceType" NOT NULL DEFAULT 'BUSINESS',
    "frequency" "ServiceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "default_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "principal_amount" DECIMAL(15,2) NOT NULL,
    "interest_rate" DECIMAL(9,6) NOT NULL,
    "start_date" DATE NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
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
    "status" "LoanScheduleStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "loan_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
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
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
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
CREATE UNIQUE INDEX "people_rut_key" ON "people"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "users_person_id_key" ON "users"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_passkey_credential_id_key" ON "users"("passkey_credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_person_id_key" ON "employees"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "counterparts_person_id_key" ON "counterparts"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_timesheets_employee_id_work_date_key" ON "employee_timesheets"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "calendars_google_id_key" ON "calendars"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_calendar_id_external_event_id_key" ON "events"("calendar_id", "external_event_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counterparts" ADD CONSTRAINT "counterparts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counterpart_accounts" ADD CONSTRAINT "counterpart_accounts_counterpart_id_fkey" FOREIGN KEY ("counterpart_id") REFERENCES "counterparts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_timesheets" ADD CONSTRAINT "employee_timesheets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_counterpart_id_fkey" FOREIGN KEY ("counterpart_id") REFERENCES "counterparts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_schedules" ADD CONSTRAINT "loan_schedules_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
