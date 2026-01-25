-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "personal";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('CONSENT', 'EXAM', 'RECIPE', 'OTHER');

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
    "password_hash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mfa_enforced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkeys" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" JSONB,
    "webauthn_user_id" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "friendly_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "conditions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "user_permission_versions" (
    "user_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_versions_pkey" PRIMARY KEY ("user_id")
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
    "metadata" JSONB,
    "overtime_rate" DECIMAL(10,2),
    "retention_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.145,

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
    "start_time" TIME(6),
    "end_time" TIME(6),
    "worked_minutes" INTEGER NOT NULL,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,

    CONSTRAINT "employee_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "description" TEXT,
    "person_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "business_unit" TEXT,
    "card_initial_number" TEXT,
    "coupon_amount" DECIMAL(17,2),
    "external_pos_id" TEXT,
    "external_reference" TEXT,
    "external_store_id" TEXT,
    "fee_amount" DECIMAL(17,2),
    "financing_fee_amount" DECIMAL(17,2),
    "franchise" TEXT,
    "installments" INTEGER,
    "invoicing_period" TEXT,
    "is_released" BOOLEAN,
    "issuer_name" TEXT,
    "last_four_digits" TEXT,
    "metadata" JSONB,
    "mkp_fee_amount" DECIMAL(17,2),
    "money_release_date" TIMESTAMP(3),
    "operation_tags" JSONB,
    "order_id" BIGINT,
    "order_mp" TEXT,
    "pack_id" BIGINT,
    "pay_bank_transfer_id" TEXT,
    "payment_method" TEXT,
    "payment_method_type" TEXT,
    "poi_bank_name" TEXT,
    "poi_id" TEXT,
    "poi_wallet_name" TEXT,
    "pos_id" TEXT,
    "pos_name" TEXT,
    "product_sku" TEXT,
    "purchase_id" TEXT,
    "real_amount" DECIMAL(17,2),
    "sale_detail" TEXT,
    "seller_amount" DECIMAL(17,2),
    "settlement_currency" VARCHAR(10),
    "settlement_date" TIMESTAMP(3),
    "settlement_net_amount" DECIMAL(17,2),
    "shipment_mode" TEXT,
    "shipping_fee_amount" DECIMAL(17,2),
    "shipping_id" BIGINT,
    "shipping_order_id" TEXT,
    "site" TEXT,
    "source_id" TEXT,
    "status" TEXT,
    "store_id" TEXT,
    "store_name" TEXT,
    "sub_unit" TEXT,
    "tax_detail" TEXT,
    "taxes_amount" DECIMAL(17,2),
    "taxes_disaggregated" JSONB,
    "tip_amount" DECIMAL(17,2),
    "total_coupon_amount" DECIMAL(17,2),
    "transaction_amount" DECIMAL(17,2) NOT NULL,
    "transaction_currency" VARCHAR(10) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "transaction_intent_id" TEXT,
    "transaction_type" TEXT NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_transactions" (
    "id" SERIAL NOT NULL,
    "source_id" VARCHAR(100) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "settlement_date" TIMESTAMP(3),
    "money_release_date" TIMESTAMP(3),
    "external_reference" VARCHAR(255),
    "user_id" VARCHAR(19),
    "payment_method_type" VARCHAR(200),
    "payment_method" VARCHAR(50),
    "site" VARCHAR(200),
    "transaction_type" VARCHAR(200) NOT NULL,
    "transaction_amount" DECIMAL(17,2) NOT NULL,
    "transaction_currency" VARCHAR(10) NOT NULL,
    "seller_amount" DECIMAL(17,2),
    "fee_amount" DECIMAL(17,2),
    "settlement_net_amount" DECIMAL(17,2),
    "settlement_currency" VARCHAR(10),
    "real_amount" DECIMAL(17,2),
    "coupon_amount" DECIMAL(17,2),
    "metadata" JSONB,
    "mkp_fee_amount" DECIMAL(17,2),
    "financing_fee_amount" DECIMAL(17,2),
    "shipping_fee_amount" DECIMAL(17,2),
    "taxes_amount" DECIMAL(17,2),
    "installments" INTEGER,
    "tax_detail" VARCHAR(50),
    "taxes_disaggregated" JSONB,
    "description" VARCHAR(50),
    "card_initial_number" VARCHAR(8),
    "operation_tags" JSONB,
    "business_unit" VARCHAR(255),
    "sub_unit" VARCHAR(255),
    "product_sku" VARCHAR(200),
    "sale_detail" VARCHAR(500),
    "transaction_intent_id" TEXT,
    "franchise" TEXT,
    "issuer_name" TEXT,
    "last_four_digits" VARCHAR(4),
    "order_mp" TEXT,
    "invoicing_period" TEXT,
    "pay_bank_transfer_id" TEXT,
    "is_released" BOOLEAN,
    "tip_amount" DECIMAL(17,2),
    "purchase_id" TEXT,
    "total_coupon_amount" DECIMAL(17,2),
    "pos_id" VARCHAR(50),
    "pos_name" VARCHAR(200),
    "external_pos_id" VARCHAR(100),
    "store_id" VARCHAR(50),
    "store_name" VARCHAR(200),
    "external_store_id" VARCHAR(100),
    "poi_id" VARCHAR(50),
    "order_id" BIGINT,
    "shipping_id" BIGINT,
    "shipment_mode" VARCHAR(10),
    "pack_id" BIGINT,
    "shipping_order_id" TEXT,
    "poi_wallet_name" VARCHAR(200),
    "poi_bank_name" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_transactions" (
    "id" SERIAL NOT NULL,
    "source_id" VARCHAR(100) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "external_reference" VARCHAR(255),
    "record_type" TEXT,
    "description" VARCHAR(500),
    "net_credit_amount" DECIMAL(17,2),
    "net_debit_amount" DECIMAL(17,2),
    "gross_amount" DECIMAL(17,2) NOT NULL,
    "seller_amount" DECIMAL(17,2),
    "mp_fee_amount" DECIMAL(17,2),
    "financing_fee_amount" DECIMAL(17,2),
    "shipping_fee_amount" DECIMAL(17,2),
    "taxes_amount" DECIMAL(17,2),
    "coupon_amount" DECIMAL(17,2),
    "effective_coupon_amount" DECIMAL(17,2),
    "balance_amount" DECIMAL(17,2),
    "tax_amount_telco" DECIMAL(17,2),
    "installments" INTEGER,
    "payment_method" VARCHAR(50),
    "payment_method_type" VARCHAR(200),
    "tax_detail" TEXT,
    "taxes_disaggregated" JSONB,
    "transaction_approval_date" TIMESTAMP(3),
    "transaction_intent_id" TEXT,
    "pos_id" TEXT,
    "pos_name" TEXT,
    "external_pos_id" TEXT,
    "store_id" TEXT,
    "store_name" TEXT,
    "external_store_id" TEXT,
    "currency" VARCHAR(10),
    "shipping_id" BIGINT,
    "shipment_mode" TEXT,
    "shipping_order_id" TEXT,
    "order_id" BIGINT,
    "pack_id" BIGINT,
    "poi_id" TEXT,
    "item_id" TEXT,
    "metadata" JSONB,
    "card_initial_number" VARCHAR(8),
    "operation_tags" JSONB,
    "last_four_digits" VARCHAR(4),
    "franchise" TEXT,
    "issuer_name" TEXT,
    "poi_bank_name" TEXT,
    "poi_wallet_name" TEXT,
    "business_unit" TEXT,
    "sub_unit" TEXT,
    "payout_bank_account_number" TEXT,
    "product_sku" TEXT,
    "sale_detail" TEXT,
    "order_mp" TEXT,
    "purchase_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_balances" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "note" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_balances_pkey" PRIMARY KEY ("id")
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
    "sync_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_watch_channels" (
    "id" SERIAL NOT NULL,
    "calendar_id" INTEGER NOT NULL,
    "channel_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_watch_channels_pkey" PRIMARY KEY ("id")
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
    "control_included" BOOLEAN NOT NULL DEFAULT false,
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
    "change_details" JSONB,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "job_id" TEXT,

    CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity_change" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_production_balances" (
    "id" SERIAL NOT NULL,
    "balance_date" DATE NOT NULL,
    "ingreso_tarjetas" INTEGER NOT NULL DEFAULT 0,
    "ingreso_transferencias" INTEGER NOT NULL DEFAULT 0,
    "ingreso_efectivo" INTEGER NOT NULL DEFAULT 0,
    "gastos_diarios" INTEGER NOT NULL DEFAULT 0,
    "otros_abonos" INTEGER NOT NULL DEFAULT 0,
    "comentarios" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "change_reason" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consultas_monto" INTEGER NOT NULL DEFAULT 0,
    "controles_monto" INTEGER NOT NULL DEFAULT 0,
    "licencias_monto" INTEGER NOT NULL DEFAULT 0,
    "roxair_monto" INTEGER NOT NULL DEFAULT 0,
    "tests_monto" INTEGER NOT NULL DEFAULT 0,
    "vacunas_monto" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_production_balances_pkey" PRIMARY KEY ("id")
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
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_supplies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "common_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_sync_logs" (
    "id" SERIAL NOT NULL,
    "trigger_source" TEXT,
    "trigger_user_id" INTEGER,
    "trigger_label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3),
    "events_synced" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER DEFAULT 0,
    "updated" INTEGER DEFAULT 0,
    "skipped" INTEGER DEFAULT 0,
    "excluded" INTEGER DEFAULT 0,
    "error_message" TEXT,
    "change_details" JSONB,

    CONSTRAINT "calendar_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctoralia_facilities" (
    "id" SERIAL NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctoralia_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctoralia_doctors" (
    "id" SERIAL NOT NULL,
    "facility_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "profile_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctoralia_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctoralia_addresses" (
    "id" SERIAL NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT,
    "city_name" TEXT,
    "post_code" TEXT,
    "street" TEXT,
    "online_only" BOOLEAN NOT NULL DEFAULT false,
    "calendar_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctoralia_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctoralia_services" (
    "id" SERIAL NOT NULL,
    "address_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "service_id" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER,
    "is_price_from" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "default_duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctoralia_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctoralia_insurance_providers" (
    "id" SERIAL NOT NULL,
    "address_id" INTEGER NOT NULL,
    "insurance_provider_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctoralia_insurance_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctoralia_slots" (
    "id" SERIAL NOT NULL,
    "address_id" INTEGER NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctoralia_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctoralia_bookings" (
    "id" SERIAL NOT NULL,
    "address_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "booked_by" TEXT,
    "booked_at" TIMESTAMP(3),
    "canceled_by" TEXT,
    "canceled_at" TIMESTAMP(3),
    "patient_name" TEXT,
    "patient_surname" TEXT,
    "patient_email" TEXT,
    "patient_phone" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctoralia_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctoralia_calendar_breaks" (
    "id" SERIAL NOT NULL,
    "address_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "till" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctoralia_calendar_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctoralia_sync_logs" (
    "id" SERIAL NOT NULL,
    "trigger_source" TEXT,
    "trigger_user_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "facilities_synced" INTEGER NOT NULL DEFAULT 0,
    "doctors_synced" INTEGER NOT NULL DEFAULT 0,
    "slots_synced" INTEGER NOT NULL DEFAULT 0,
    "bookings_synced" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "doctoralia_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal"."credits" (
    "id" SERIAL NOT NULL,
    "bank_name" TEXT NOT NULL,
    "credit_number" TEXT NOT NULL,
    "description" TEXT,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "interest_rate" DECIMAL(5,2),
    "start_date" DATE NOT NULL,
    "total_installments" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal"."credit_installments" (
    "id" SERIAL NOT NULL,
    "credit_id" INTEGER NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "capital_amount" DECIMAL(15,2),
    "interest_amount" DECIMAL(15,2),
    "other_charges" DECIMAL(15,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "paid_amount" DECIMAL(15,2),

    CONSTRAINT "credit_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_certificates" (
    "id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_rut" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "address" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "symptoms" TEXT,
    "rest_days" INTEGER,
    "rest_start_date" DATE,
    "rest_end_date" DATE,
    "purpose" TEXT NOT NULL,
    "purpose_detail" TEXT,
    "issued_by" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patient_id" INTEGER,
    "drive_file_id" TEXT NOT NULL,
    "pdf_hash" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "medical_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "birth_date" DATE NOT NULL,
    "blood_type" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "event_id" INTEGER,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "diagnosis" TEXT,
    "treatment" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(15,2) NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" SERIAL NOT NULL,
    "budget_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "total_price" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_payments" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "budget_id" INTEGER,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_attachments" (
    "id" TEXT NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL DEFAULT 'OTHER',
    "drive_file_id" TEXT NOT NULL,
    "mime_type" TEXT,
    "uploaded_by" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "people_rut_key" ON "people"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "users_person_id_key" ON "users"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");

-- CreateIndex
CREATE INDEX "passkeys_userId_idx" ON "passkeys"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_subject_key" ON "permissions"("action", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "employees_person_id_key" ON "employees"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "counterparts_person_id_key" ON "counterparts"("person_id");

-- CreateIndex
CREATE INDEX "counterpart_accounts_counterpart_id_idx" ON "counterpart_accounts"("counterpart_id");

-- CreateIndex
CREATE INDEX "employee_timesheets_employee_id_idx" ON "employee_timesheets"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_timesheets_employee_id_work_date_key" ON "employee_timesheets"("employee_id", "work_date");

-- CreateIndex
CREATE INDEX "transactions_person_id_idx" ON "transactions"("person_id");

-- CreateIndex
CREATE INDEX "transactions_transaction_date_idx" ON "transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_transaction_type_idx" ON "transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "transactions_external_reference_idx" ON "transactions"("external_reference");

-- CreateIndex
CREATE INDEX "transactions_source_id_idx" ON "transactions"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_mp_tx" ON "transactions"("source_id", "transaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_transactions_source_id_key" ON "settlement_transactions"("source_id");

-- CreateIndex
CREATE INDEX "settlement_transactions_transaction_date_idx" ON "settlement_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "settlement_transactions_transaction_type_idx" ON "settlement_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "settlement_transactions_external_reference_idx" ON "settlement_transactions"("external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "release_transactions_source_id_key" ON "release_transactions"("source_id");

-- CreateIndex
CREATE INDEX "release_transactions_date_idx" ON "release_transactions"("date");

-- CreateIndex
CREATE INDEX "release_transactions_source_id_idx" ON "release_transactions"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_balances_date_key" ON "daily_balances"("date");

-- CreateIndex
CREATE INDEX "services_counterpart_id_idx" ON "services"("counterpart_id");

-- CreateIndex
CREATE INDEX "loan_schedules_loan_id_idx" ON "loan_schedules"("loan_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendars_google_id_key" ON "calendars"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_watch_channels_channel_id_key" ON "calendar_watch_channels"("channel_id");

-- CreateIndex
CREATE INDEX "calendar_watch_channels_calendar_id_idx" ON "calendar_watch_channels"("calendar_id");

-- CreateIndex
CREATE INDEX "events_calendar_id_idx" ON "events"("calendar_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_calendar_id_external_event_id_key" ON "events"("calendar_id", "external_event_id");

-- CreateIndex
CREATE INDEX "sync_logs_trigger_source_idx" ON "sync_logs"("trigger_source");

-- CreateIndex
CREATE INDEX "sync_logs_started_at_idx" ON "sync_logs"("started_at");

-- CreateIndex
CREATE INDEX "backup_logs_timestamp_idx" ON "backup_logs"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_name_key" ON "inventory_categories"("name");

-- CreateIndex
CREATE INDEX "inventory_items_category_id_idx" ON "inventory_items"("category_id");

-- CreateIndex
CREATE INDEX "inventory_movements_item_id_idx" ON "inventory_movements"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_production_balances_balance_date_key" ON "daily_production_balances"("balance_date");

-- CreateIndex
CREATE INDEX "daily_production_balances_created_by_idx" ON "daily_production_balances"("created_by");

-- CreateIndex
CREATE INDEX "supply_requests_user_id_idx" ON "supply_requests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "common_supplies_name_brand_model_key" ON "common_supplies"("name", "brand", "model");

-- CreateIndex
CREATE INDEX "calendar_sync_logs_started_at_idx" ON "calendar_sync_logs"("started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "doctoralia_facilities_external_id_key" ON "doctoralia_facilities"("external_id");

-- CreateIndex
CREATE INDEX "doctoralia_doctors_facility_id_idx" ON "doctoralia_doctors"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctoralia_doctors_facility_id_external_id_key" ON "doctoralia_doctors"("facility_id", "external_id");

-- CreateIndex
CREATE INDEX "doctoralia_addresses_doctor_id_idx" ON "doctoralia_addresses"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctoralia_addresses_doctor_id_external_id_key" ON "doctoralia_addresses"("doctor_id", "external_id");

-- CreateIndex
CREATE INDEX "doctoralia_services_address_id_idx" ON "doctoralia_services"("address_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctoralia_services_address_id_external_id_key" ON "doctoralia_services"("address_id", "external_id");

-- CreateIndex
CREATE INDEX "doctoralia_insurance_providers_address_id_idx" ON "doctoralia_insurance_providers"("address_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctoralia_insurance_providers_address_id_insurance_provide_key" ON "doctoralia_insurance_providers"("address_id", "insurance_provider_id");

-- CreateIndex
CREATE INDEX "doctoralia_slots_address_id_idx" ON "doctoralia_slots"("address_id");

-- CreateIndex
CREATE INDEX "doctoralia_slots_start_at_idx" ON "doctoralia_slots"("start_at");

-- CreateIndex
CREATE INDEX "doctoralia_bookings_address_id_idx" ON "doctoralia_bookings"("address_id");

-- CreateIndex
CREATE INDEX "doctoralia_bookings_start_at_idx" ON "doctoralia_bookings"("start_at");

-- CreateIndex
CREATE UNIQUE INDEX "doctoralia_bookings_address_id_external_id_key" ON "doctoralia_bookings"("address_id", "external_id");

-- CreateIndex
CREATE INDEX "doctoralia_calendar_breaks_address_id_idx" ON "doctoralia_calendar_breaks"("address_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctoralia_calendar_breaks_address_id_external_id_key" ON "doctoralia_calendar_breaks"("address_id", "external_id");

-- CreateIndex
CREATE INDEX "doctoralia_sync_logs_started_at_idx" ON "doctoralia_sync_logs"("started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "credits_credit_number_key" ON "personal"."credits"("credit_number");

-- CreateIndex
CREATE INDEX "credit_installments_credit_id_idx" ON "personal"."credit_installments"("credit_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_installments_credit_id_installment_number_key" ON "personal"."credit_installments"("credit_id", "installment_number");

-- CreateIndex
CREATE INDEX "medical_certificates_patient_rut_idx" ON "medical_certificates"("patient_rut");

-- CreateIndex
CREATE INDEX "medical_certificates_issued_at_idx" ON "medical_certificates"("issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "patients_person_id_key" ON "patients"("person_id");

-- CreateIndex
CREATE INDEX "consultations_patient_id_idx" ON "consultations"("patient_id");

-- CreateIndex
CREATE INDEX "consultations_event_id_idx" ON "consultations"("event_id");

-- CreateIndex
CREATE INDEX "consultations_date_idx" ON "consultations"("date");

-- CreateIndex
CREATE INDEX "budgets_patient_id_idx" ON "budgets"("patient_id");

-- CreateIndex
CREATE INDEX "budget_items_budget_id_idx" ON "budget_items"("budget_id");

-- CreateIndex
CREATE INDEX "patient_payments_patient_id_idx" ON "patient_payments"("patient_id");

-- CreateIndex
CREATE INDEX "patient_payments_budget_id_idx" ON "patient_payments"("budget_id");

-- CreateIndex
CREATE INDEX "patient_attachments_patient_id_idx" ON "patient_attachments"("patient_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_versions" ADD CONSTRAINT "user_permission_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_watch_channels" ADD CONSTRAINT "calendar_watch_channels_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_balances" ADD CONSTRAINT "daily_production_balances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctoralia_doctors" ADD CONSTRAINT "doctoralia_doctors_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "doctoralia_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctoralia_addresses" ADD CONSTRAINT "doctoralia_addresses_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctoralia_doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctoralia_services" ADD CONSTRAINT "doctoralia_services_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "doctoralia_addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctoralia_insurance_providers" ADD CONSTRAINT "doctoralia_insurance_providers_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "doctoralia_addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctoralia_slots" ADD CONSTRAINT "doctoralia_slots_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "doctoralia_addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctoralia_bookings" ADD CONSTRAINT "doctoralia_bookings_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "doctoralia_addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctoralia_calendar_breaks" ADD CONSTRAINT "doctoralia_calendar_breaks_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "doctoralia_addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."credit_installments" ADD CONSTRAINT "credit_installments_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "personal"."credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_payments" ADD CONSTRAINT "patient_payments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_payments" ADD CONSTRAINT "patient_payments_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_attachments" ADD CONSTRAINT "patient_attachments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_attachments" ADD CONSTRAINT "patient_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

