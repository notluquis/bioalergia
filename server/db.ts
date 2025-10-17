import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import type { PayoutRecord } from "./transformPayouts.js";
import { EFFECTIVE_TIMESTAMP_EXPR } from "./lib/transactions.js";
import { normalizeRut, validateRut } from "./lib/rut.js";
import { formatLocalDateForMySQL } from "./lib/time.js";
import { InventoryCategory, InventoryItem, InventoryMovement } from "./types.js";
import { roundCurrency } from "../shared/currency.js";
import { SQLBuilder, selectMany } from "./lib/database.js";

dotenv.config();

type Pool = mysql.Pool;
export type UserRole = "GOD" | "ADMIN" | "ANALYST" | "VIEWER";

export type UserRecord = {
  id: number;
  email: string;
  role: UserRole;
  password_hash: string;
  name: string | null;
};

export type CounterpartPersonType = "PERSON" | "COMPANY" | "OTHER";

export type CounterpartRecord = {
  id: number;
  rut: string | null;
  name: string;
  personType: CounterpartPersonType;
  category: "SUPPLIER" | "PATIENT" | "EMPLOYEE" | "PARTNER" | "RELATED" | "OTHER";
  employeeId: number | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type LoanFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
export type LoanInterestType = "SIMPLE" | "COMPOUND";
export type LoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED";

export type LoanRecord = {
  id: number;
  public_id: string;
  title: string;
  borrower_name: string;
  borrower_type: "PERSON" | "COMPANY";
  principal_amount: number;
  interest_rate: number;
  interest_type: LoanInterestType;
  frequency: LoanFrequency;
  total_installments: number;
  start_date: string;
  status: LoanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type LoanScheduleRecord = {
  id: number;
  loan_id: number;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  expected_principal: number;
  expected_interest: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  transaction_id: number | null;
  paid_amount: number | null;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
};

export type LoanWithSummary = LoanRecord & {
  total_expected: number;
  total_paid: number;
  remaining_amount: number;
  paid_installments: number;
  pending_installments: number;
};

export type LoanScheduleWithTransaction = LoanScheduleRecord & {
  transaction?: {
    id: number;
    description: string | null;
    timestamp: string;
    amount: number | null;
  } | null;
};

export type ServiceFrequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "ONCE";
export type ServiceType =
  | "BUSINESS"
  | "PERSONAL"
  | "SUPPLIER"
  | "TAX"
  | "UTILITY"
  | "LEASE"
  | "SOFTWARE"
  | "OTHER";
export type ServiceOwnership = "COMPANY" | "OWNER" | "MIXED" | "THIRD_PARTY";
export type ServiceObligationType = "SERVICE" | "DEBT" | "LOAN" | "OTHER";
export type ServiceRecurrenceType = "RECURRING" | "ONE_OFF";
export type ServiceAmountIndexation = "NONE" | "UF";
export type ServiceLateFeeMode = "NONE" | "FIXED" | "PERCENTAGE";
export type ServiceEmissionMode = "FIXED_DAY" | "DATE_RANGE" | "SPECIFIC_DATE";
export type ServiceStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type ServiceRecord = {
  id: number;
  public_id: string;
  name: string;
  detail: string | null;
  category: string | null;
  service_type: ServiceType;
  ownership: ServiceOwnership;
  obligation_type: ServiceObligationType;
  recurrence_type: ServiceRecurrenceType;
  frequency: ServiceFrequency;
  default_amount: number;
  amount_indexation: ServiceAmountIndexation;
  counterpart_id: number | null;
  counterpart_account_id: number | null;
  account_reference: string | null;
  emission_day: number | null;
  emission_mode: ServiceEmissionMode;
  emission_start_day: number | null;
  emission_end_day: number | null;
  emission_exact_date: string | null;
  due_day: number | null;
  start_date: string;
  next_generation_months: number;
  late_fee_mode: ServiceLateFeeMode;
  late_fee_value: number | null;
  late_fee_grace_days: number | null;
  status: ServiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  counterpart_name?: string | null;
  counterpart_account_identifier?: string | null;
  counterpart_account_bank_name?: string | null;
  counterpart_account_type?: string | null;
};

export type ServiceScheduleRecord = {
  id: number;
  service_id: number;
  period_start: string;
  period_end: string;
  due_date: string;
  expected_amount: number;
  status: "PENDING" | "PAID" | "PARTIAL" | "SKIPPED";
  transaction_id: number | null;
  paid_amount: number | null;
  paid_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  late_fee_amount: number;
  effective_amount: number;
  overdue_days: number;
};

export type ServiceWithSummary = ServiceRecord & {
  total_expected: number;
  total_paid: number;
  pending_count: number;
  overdue_count: number;
};

export type ServiceScheduleWithTransaction = ServiceScheduleRecord & {
  transaction?: {
    id: number;
    description: string | null;
    timestamp: string;
    amount: number | null;
  } | null;
};

export type MonthlyExpenseSource = "MANUAL" | "TRANSACTION" | "SERVICE";

export type MonthlyExpenseRecord = {
  id: number;
  public_id: string;
  name: string;
  category: string | null;
  amount_expected: number;
  expense_date: string;
  notes: string | null;
  source: MonthlyExpenseSource;
  service_id: number | null;
  tags: string[];
  status: "OPEN" | "CLOSED";
  created_at: string;
  updated_at: string;
  amount_applied: number;
  transaction_count: number;
};

export type MonthlyExpenseDetail = MonthlyExpenseRecord & {
  transactions: Array<{
    transaction_id: number;
    amount: number;
    timestamp: string;
    description: string | null;
    direction: string;
  }>;
};

export type CreateMonthlyExpensePayload = {
  name: string;
  category?: string | null;
  amountExpected: number;
  expenseDate: string;
  notes?: string | null;
  source?: MonthlyExpenseSource;
  serviceId?: number | null;
  tags?: string[];
  status?: 'OPEN' | 'CLOSED';
};

export type LinkMonthlyExpenseTransactionPayload = {
  transactionId: number;
  amount?: number;
};

export type CounterpartAccountRecord = {
  id: number;
  counterpart_id: number;
  account_identifier: string;
  bank_name: string | null;
  account_type: string | null;
  holder: string | null;
  concept: string | null;
  metadata: CounterpartAccountMetadata | null;
  created_at: string;
  updated_at: string;
};

export type CounterpartAccountMetadata = {
  bankAccountNumber?: string | null;
  withdrawId?: string | null;
};

export type AppSettings = {
  orgName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  dbDisplayHost: string;
  dbDisplayName: string;
  dbConsoleUrl: string;
  cpanelUrl: string;
  orgAddress: string;
  orgPhone: string;
  primaryCurrency: string;
  supportEmail: string;
  pageTitle: string;
  calendarTimeZone: string;
  calendarSyncStart: string;
  calendarSyncLookaheadDays: string;
  calendarExcludeSummaries: string;
  calendarDailyMaxDays: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  orgName: "Bioalergia",
  tagline: "Gestión integral de finanzas",
  primaryColor: "#0e64b7",
  secondaryColor: "#f1a722",
  logoUrl: "",
  faviconUrl: "/logo_bimi.svg",
  dbDisplayHost: "localhost",
  dbDisplayName: "finanzas",
  dbConsoleUrl: "",
  cpanelUrl: "",
  orgAddress: "",
  orgPhone: "",
  primaryCurrency: "CLP",
  supportEmail: "soporte@bioalergia.cl",
  pageTitle: "Bioalergia · Finanzas",
  calendarTimeZone: "America/Santiago",
  calendarSyncStart: "2000-01-01",
  calendarSyncLookaheadDays: "365",
  calendarExcludeSummaries: "No Disponible",
  calendarDailyMaxDays: "31",
};

const SETTINGS_KEY_MAP: Record<keyof AppSettings, string> = {
  orgName: "brand.orgName",
  tagline: "brand.tagline",
  primaryColor: "brand.primaryColor",
  secondaryColor: "brand.secondaryColor",
  logoUrl: "brand.logoUrl",
  faviconUrl: "brand.faviconUrl",
  dbDisplayHost: "db.displayHost",
  dbDisplayName: "db.displayName",
  dbConsoleUrl: "db.consoleUrl",
  cpanelUrl: "cpanel.url",
  orgAddress: "org.address",
  orgPhone: "org.phone",
  primaryCurrency: "org.primaryCurrency",
  supportEmail: "contact.supportEmail",
  pageTitle: "brand.pageTitle",
  calendarTimeZone: "calendar.timeZone",
  calendarSyncStart: "calendar.syncStart",
  calendarSyncLookaheadDays: "calendar.syncLookaheadDays",
  calendarExcludeSummaries: "calendar.excludeSummaries",
  calendarDailyMaxDays: "calendar.dailyMaxDays",
};

const REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"] as const;

let pool: Pool | null = null;

function isDuplicateColumnError(error: unknown): boolean {
  return error instanceof Error && /Duplicate column name/i.test(error.message);
}

async function addColumnIfMissing(pool: Pool, table: string, columnDefinition: string) {
  try {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition}` as string);
  } catch (error) {
    if (typeof error !== "object" || error == null) throw error;
    const code = (error as { code?: string }).code;
    if (code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
}

function assertEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Faltan variables de entorno para la base de datos: ${missing.join(", ")}. ` +
        `Configura el archivo .env con las credenciales de HostGator.`
    );
  }
}

export function getPool(): Pool {
  if (pool) return pool;
  assertEnv();

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 8,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT ?? 5000),
    namedPlaceholders: false,
    dateStrings: true,
  });

  return pool;
}

export async function ensureSchema() {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_transactions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      timestamp_raw VARCHAR(64) NOT NULL,
      timestamp DATETIME NOT NULL,
      description VARCHAR(255) NULL,
      origin VARCHAR(191) NULL,
      destination VARCHAR(191) NULL,
      source_id VARCHAR(191) NULL,
      direction ENUM('IN','OUT','NEUTRO') NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      raw_json TEXT NULL,
      source_file VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_movement (timestamp_raw, direction, amount, origin, destination, source_file)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing(pool, "mp_transactions", "`source_id` VARCHAR(191) NULL AFTER `destination`");

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_withdrawals (
      withdraw_id VARCHAR(191) NOT NULL,
      date_created DATETIME NULL,
      status VARCHAR(64) NULL,
      status_detail VARCHAR(120) NULL,
      amount DECIMAL(15, 2) NULL,
      fee DECIMAL(15, 2) NULL,
      activity_url TEXT NULL,
      payout_desc VARCHAR(255) NULL,
      bank_account_holder VARCHAR(191) NULL,
      identification_type VARCHAR(32) NULL,
      identification_number VARCHAR(64) NULL,
      bank_id VARCHAR(32) NULL,
      bank_name VARCHAR(120) NULL,
      bank_branch VARCHAR(120) NULL,
      bank_account_type VARCHAR(64) NULL,
      bank_account_number VARCHAR(64) NULL,
      raw_json JSON NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (withdraw_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_counterparts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      rut VARCHAR(64) NULL,
      name VARCHAR(191) NOT NULL,
      person_type ENUM('PERSON','COMPANY','OTHER') NOT NULL DEFAULT 'OTHER',
      category ENUM('SUPPLIER','PATIENT','EMPLOYEE','PARTNER','RELATED','OTHER') NOT NULL DEFAULT 'SUPPLIER',
      employee_id INT UNSIGNED NULL,
      email VARCHAR(191) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_counterpart_rut (rut),
      INDEX idx_counterpart_employee (employee_id),
      CONSTRAINT fk_counterpart_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_counterpart_accounts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      counterpart_id INT UNSIGNED NOT NULL,
      account_identifier VARCHAR(191) NOT NULL,
      bank_name VARCHAR(191) NULL,
      account_type VARCHAR(64) NULL,
      holder VARCHAR(191) NULL,
      concept VARCHAR(191) NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_counterpart_account_identifier (account_identifier),
      CONSTRAINT fk_counterpart_account FOREIGN KEY (counterpart_id) REFERENCES mp_counterparts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing(
    pool,
    "mp_counterparts",
    "`category` ENUM('SUPPLIER','PATIENT','EMPLOYEE','PARTNER','RELATED','OTHER') NOT NULL DEFAULT 'SUPPLIER' AFTER person_type"
  );
  await addColumnIfMissing(
    pool,
    "mp_counterparts",
    "`employee_id` INT UNSIGNED NULL AFTER category"
  );
  try {
    await pool.query(
      `ALTER TABLE mp_counterparts
        ADD CONSTRAINT fk_counterpart_employee FOREIGN KEY (employee_id)
        REFERENCES employees(id) ON DELETE SET NULL`
    );
  } catch (error) {
    if ((error as { code?: string }).code !== "ER_CANT_CREATE_TABLE") {
      const code = (error as { code?: string }).code;
      if (code !== "ER_DUP_KEY" && code !== "ER_CANNOT_ADD_FOREIGN" && code !== "ER_FOREIGN_DUPLICATE_KEY") {
        // ignore duplicate constraint errors
      }
    }
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS mp_daily_balances (
      balance_date DATE NOT NULL,
      balance DECIMAL(15, 2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (balance_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS google_calendar_events (
      calendar_id VARCHAR(191) NOT NULL,
      event_id VARCHAR(191) NOT NULL,
      event_status VARCHAR(32) NULL,
      event_type VARCHAR(64) NULL,
      summary VARCHAR(512) NULL,
      description TEXT NULL,
      start_date DATE NULL,
      start_date_time DATETIME NULL,
      start_time_zone VARCHAR(64) NULL,
      end_date DATE NULL,
      end_date_time DATETIME NULL,
      end_time_zone VARCHAR(64) NULL,
      event_created_at DATETIME NULL,
      event_updated_at DATETIME NULL,
      color_id VARCHAR(32) NULL,
      location VARCHAR(512) NULL,
      transparency VARCHAR(32) NULL,
      visibility VARCHAR(32) NULL,
      hangout_link VARCHAR(512) NULL,
      raw_event JSON NULL,
      last_synced_at DATETIME NOT NULL,
      PRIMARY KEY (calendar_id, event_id),
      INDEX idx_google_calendar_events_updated (event_updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing(
    pool,
    "google_calendar_events",
    "`event_type` VARCHAR(64) NULL AFTER `event_status`"
  );

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(191) NOT NULL,
      password_hash VARCHAR(191) NOT NULL,
      role ENUM('GOD','ADMIN','ANALYST','VIEWER') NOT NULL DEFAULT 'VIEWER',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_user_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      config_key VARCHAR(128) NOT NULL,
      config_value TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (config_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      full_name VARCHAR(191) NOT NULL,
      role VARCHAR(120) NOT NULL,
      email VARCHAR(191) NULL,
      salary_type ENUM('hourly','fixed') NOT NULL DEFAULT 'hourly',
      hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
      fixed_salary DECIMAL(12, 2) NULL,
      overtime_rate DECIMAL(10, 2) NULL,
      retention_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,
      status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Extend employees with RUT and banking info (idempotent)
  // Extiende empleados con tipo de salario y sueldo fijo (idempotente)
  await addColumnIfMissing(pool, "employees", "`salary_type` ENUM('hourly','fixed') NOT NULL DEFAULT 'hourly' AFTER email");
  await addColumnIfMissing(pool, "employees", "`fixed_salary` DECIMAL(12,2) NULL AFTER hourly_rate");
  await addColumnIfMissing(pool, "employees", "`rut` VARCHAR(20) NULL AFTER email");
  await addColumnIfMissing(pool, "employees", "`bank_name` VARCHAR(120) NULL AFTER rut");
  await addColumnIfMissing(pool, "employees", "`bank_account_type` VARCHAR(32) NULL AFTER bank_name");
  await addColumnIfMissing(pool, "employees", "`bank_account_number` VARCHAR(64) NULL AFTER bank_account_type");

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS employee_timesheets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      employee_id INT UNSIGNED NOT NULL,
      work_date DATE NOT NULL,
      start_time TIME NULL,
      end_time TIME NULL,
      worked_minutes INT NOT NULL,
      overtime_minutes INT NOT NULL DEFAULT 0,
      extra_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
      comment VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_employee_day (employee_id, work_date),
      INDEX idx_employee_timesheets_employee (employee_id),
      CONSTRAINT fk_timesheet_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS common_supplies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        brand VARCHAR(255),
        model VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS supply_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        supply_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        brand VARCHAR(255),
        model VARCHAR(255),
        notes TEXT,
        status ENUM('pending', 'ordered', 'in_transit', 'delivered', 'rejected') DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS loans (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      public_id CHAR(36) NOT NULL,
      title VARCHAR(191) NOT NULL,
      borrower_name VARCHAR(191) NOT NULL,
      borrower_type ENUM('PERSON','COMPANY') NOT NULL DEFAULT 'PERSON',
      principal_amount DECIMAL(15, 2) NOT NULL,
      interest_rate DECIMAL(9, 6) NOT NULL,
      interest_type ENUM('SIMPLE','COMPOUND') NOT NULL DEFAULT 'SIMPLE',
      frequency ENUM('WEEKLY','BIWEEKLY','MONTHLY') NOT NULL,
      total_installments INT UNSIGNED NOT NULL,
      start_date DATE NOT NULL,
      status ENUM('ACTIVE','COMPLETED','DEFAULTED') NOT NULL DEFAULT 'ACTIVE',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_loans_public_id (public_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS loan_schedules (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      loan_id INT UNSIGNED NOT NULL,
      installment_number INT UNSIGNED NOT NULL,
      due_date DATE NOT NULL,
      expected_amount DECIMAL(15, 2) NOT NULL,
      expected_principal DECIMAL(15, 2) NOT NULL,
      expected_interest DECIMAL(15, 2) NOT NULL,
      status ENUM('PENDING','PARTIAL','PAID','OVERDUE') NOT NULL DEFAULT 'PENDING',
      transaction_id INT UNSIGNED NULL,
      paid_amount DECIMAL(15, 2) NULL,
      paid_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_schedule_installment (loan_id, installment_number),
      KEY idx_schedule_due_date (due_date),
      KEY idx_schedule_transaction (transaction_id),
      CONSTRAINT fk_schedule_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
      CONSTRAINT fk_schedule_transaction FOREIGN KEY (transaction_id) REFERENCES mp_transactions(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS services (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      public_id CHAR(36) NOT NULL,
      name VARCHAR(191) NOT NULL,
      detail VARCHAR(255) NULL,
      category VARCHAR(120) NULL,
      service_type ENUM('BUSINESS','PERSONAL','SUPPLIER','TAX','UTILITY','LEASE','SOFTWARE','OTHER') NOT NULL DEFAULT 'BUSINESS',
      ownership ENUM('COMPANY','OWNER','MIXED','THIRD_PARTY') NOT NULL DEFAULT 'COMPANY',
      obligation_type ENUM('SERVICE','DEBT','LOAN','OTHER') NOT NULL DEFAULT 'SERVICE',
      recurrence_type ENUM('RECURRING','ONE_OFF') NOT NULL DEFAULT 'RECURRING',
      frequency ENUM('WEEKLY','BIWEEKLY','MONTHLY','BIMONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','ONCE') NOT NULL DEFAULT 'MONTHLY',
      default_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_indexation ENUM('NONE','UF') NOT NULL DEFAULT 'NONE',
      counterpart_id INT UNSIGNED NULL,
      counterpart_account_id INT UNSIGNED NULL,
      account_reference VARCHAR(191) NULL,
      emission_day TINYINT NULL,
      emission_mode ENUM('FIXED_DAY','DATE_RANGE','SPECIFIC_DATE') NOT NULL DEFAULT 'FIXED_DAY',
      emission_start_day TINYINT NULL,
      emission_end_day TINYINT NULL,
      emission_exact_date DATE NULL,
      due_day TINYINT NULL,
      start_date DATE NOT NULL,
      next_generation_months INT UNSIGNED NOT NULL DEFAULT 12,
      late_fee_mode ENUM('NONE','FIXED','PERCENTAGE') NOT NULL DEFAULT 'NONE',
      late_fee_value DECIMAL(15,2) NULL,
      late_fee_grace_days TINYINT NULL,
      status ENUM('ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_services_public_id (public_id),
      KEY idx_services_counterpart (counterpart_id),
      KEY idx_services_account (counterpart_account_id),
      CONSTRAINT fk_services_counterpart FOREIGN KEY (counterpart_id) REFERENCES mp_counterparts(id) ON DELETE SET NULL,
      CONSTRAINT fk_services_account FOREIGN KEY (counterpart_account_id) REFERENCES mp_counterpart_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Agregar columnas de servicios de forma segura
  const columnsToAdd = [
    { name: 'ownership', sql: "ADD COLUMN ownership ENUM('COMPANY','OWNER','MIXED','THIRD_PARTY') NOT NULL DEFAULT 'COMPANY' AFTER service_type" },
    { name: 'obligation_type', sql: "ADD COLUMN obligation_type ENUM('SERVICE','DEBT','LOAN','OTHER') NOT NULL DEFAULT 'SERVICE' AFTER ownership" },
    { name: 'recurrence_type', sql: "ADD COLUMN recurrence_type ENUM('RECURRING','ONE_OFF') NOT NULL DEFAULT 'RECURRING' AFTER obligation_type" },
    { name: 'amount_indexation', sql: "ADD COLUMN amount_indexation ENUM('NONE','UF') NOT NULL DEFAULT 'NONE' AFTER default_amount" },
    { name: 'counterpart_id', sql: "ADD COLUMN counterpart_id INT UNSIGNED NULL AFTER amount_indexation" },
    { name: 'counterpart_account_id', sql: "ADD COLUMN counterpart_account_id INT UNSIGNED NULL AFTER counterpart_id" },
    { name: 'account_reference', sql: "ADD COLUMN account_reference VARCHAR(191) NULL AFTER counterpart_account_id" },
    { name: 'emission_mode', sql: "ADD COLUMN emission_mode ENUM('FIXED_DAY','DATE_RANGE','SPECIFIC_DATE') NOT NULL DEFAULT 'FIXED_DAY' AFTER emission_day" },
    { name: 'emission_start_day', sql: "ADD COLUMN emission_start_day TINYINT NULL AFTER emission_mode" },
    { name: 'emission_end_day', sql: "ADD COLUMN emission_end_day TINYINT NULL AFTER emission_start_day" },
    { name: 'emission_exact_date', sql: "ADD COLUMN emission_exact_date DATE NULL AFTER emission_end_day" },
    { name: 'start_date', sql: "ADD COLUMN start_date DATE NOT NULL DEFAULT '1970-01-01' AFTER due_day" },
    { name: 'late_fee_mode', sql: "ADD COLUMN late_fee_mode ENUM('NONE','FIXED','PERCENTAGE') NOT NULL DEFAULT 'NONE' AFTER next_generation_months" },
    { name: 'late_fee_value', sql: "ADD COLUMN late_fee_value DECIMAL(15,2) NULL AFTER late_fee_mode" },
    { name: 'late_fee_grace_days', sql: "ADD COLUMN late_fee_grace_days TINYINT NULL AFTER late_fee_value" }
  ];

  for (const column of columnsToAdd) {
    try {
      // Verificar si la columna existe
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services' AND COLUMN_NAME = ?`,
        [column.name]
      );
      
      // Si no existe, agregarla
      if (rows.length === 0) {
        await pool.execute(`ALTER TABLE services ${column.sql}`);
      }
    } catch (error) {
      // Ignorar errores de columnas que ya existen
      if (!isDuplicateColumnError(error)) {
        throw error;
      }
    }
  }

  await pool.execute(`
    ALTER TABLE services
      MODIFY COLUMN service_type ENUM('BUSINESS','PERSONAL','SUPPLIER','TAX','UTILITY','LEASE','SOFTWARE','OTHER') NOT NULL DEFAULT 'BUSINESS',
      MODIFY COLUMN frequency ENUM('WEEKLY','BIWEEKLY','MONTHLY','BIMONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','ONCE') NOT NULL DEFAULT 'MONTHLY';
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS service_schedules (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      service_id INT UNSIGNED NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      due_date DATE NOT NULL,
      expected_amount DECIMAL(15,2) NOT NULL,
      status ENUM('PENDING','PAID','PARTIAL','SKIPPED') NOT NULL DEFAULT 'PENDING',
      transaction_id INT UNSIGNED NULL,
      paid_amount DECIMAL(15,2) NULL,
      paid_date DATE NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_service_period (service_id, period_start),
      KEY idx_service_due (due_date),
      KEY idx_service_transaction (transaction_id),
      CONSTRAINT fk_service_schedule_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
      CONSTRAINT fk_service_schedule_transaction FOREIGN KEY (transaction_id) REFERENCES mp_transactions(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [serviceScheduleIndex] = await pool.query<RowDataPacket[]>(
    `SELECT 1
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'service_schedules'
        AND INDEX_NAME = 'uniq_service_period'
      LIMIT 1`
  );
  if (!serviceScheduleIndex.length) {
    await pool.execute(
      `ALTER TABLE service_schedules ADD UNIQUE KEY uniq_service_period (service_id, period_start)`
    );
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS monthly_expenses (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      public_id CHAR(36) NOT NULL,
      name VARCHAR(191) NOT NULL,
      category VARCHAR(120) NULL,
      amount_expected DECIMAL(15,2) NOT NULL DEFAULT 0,
      expense_date DATE NOT NULL,
      notes TEXT NULL,
      source ENUM('MANUAL','TRANSACTION','SERVICE') NOT NULL DEFAULT 'MANUAL',
      service_id INT UNSIGNED NULL,
      tags JSON NULL,
      status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_monthly_expenses_public (public_id),
      KEY idx_monthly_expenses_date (expense_date),
      KEY idx_monthly_expenses_service (service_id),
      CONSTRAINT fk_monthly_expenses_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS monthly_expense_transactions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      monthly_expense_id INT UNSIGNED NOT NULL,
      transaction_id INT UNSIGNED NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_expense_transaction (monthly_expense_id, transaction_id),
      KEY idx_expense_transaction_tx (transaction_id),
      CONSTRAINT fk_expense_transaction_expense FOREIGN KEY (monthly_expense_id) REFERENCES monthly_expenses(id) ON DELETE CASCADE,
      CONSTRAINT fk_expense_transaction_tx FOREIGN KEY (transaction_id) REFERENCES mp_transactions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await seedDefaultSettings(pool);
  await seedDefaultAdmin(pool);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS role_mappings (
      employee_role VARCHAR(120) NOT NULL,
      app_role ENUM('GOD','ADMIN','ANALYST','VIEWER') NOT NULL,
      PRIMARY KEY (employee_role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const inventorySchemaPath = path.join(__dirname, 'sql', 'create_inventory_tables.sql');
  const inventorySchemaSql = await fs.readFile(inventorySchemaPath, 'utf-8');
  const inventoryStatements = inventorySchemaSql.split(';').filter(s => s.trim().length > 0);

  for (const statement of inventoryStatements) {
    if (statement.trim().length === 0) continue;
    await pool.execute(statement);
  }
}

function mapLoanRow(row: RowDataPacket): LoanRecord {
  return {
    id: Number(row.id),
    public_id: String(row.public_id),
    title: String(row.title),
    borrower_name: String(row.borrower_name),
    borrower_type: row.borrower_type as 'PERSON' | 'COMPANY',
    principal_amount: Number(row.principal_amount ?? 0),
    interest_rate: Number(row.interest_rate ?? 0),
    interest_type: (row.interest_type as LoanInterestType) ?? 'SIMPLE',
    frequency: (row.frequency as LoanFrequency) ?? 'MONTHLY',
    total_installments: Number(row.total_installments ?? 0),
    start_date: toDateOnly(row.start_date),
    status: (row.status as LoanStatus) ?? 'ACTIVE',
    notes: row.notes != null ? String(row.notes) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  } satisfies LoanRecord;
}

function mapLoanScheduleRow(row: RowDataPacket): LoanScheduleRecord {
  return {
    id: Number(row.id),
    loan_id: Number(row.loan_id),
    installment_number: Number(row.installment_number),
    due_date: toDateOnly(row.due_date),
    expected_amount: Number(row.expected_amount ?? 0),
    expected_principal: Number(row.expected_principal ?? 0),
    expected_interest: Number(row.expected_interest ?? 0),
    status: (row.status as LoanScheduleRecord['status']) ?? 'PENDING',
    transaction_id: row.transaction_id != null ? Number(row.transaction_id) : null,
    paid_amount: row.paid_amount != null ? Number(row.paid_amount) : null,
    paid_date: row.paid_date ? toDateOnly(row.paid_date) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  } satisfies LoanScheduleRecord;
}

export type CreateLoanPayload = {
  title: string;
  borrowerName: string;
  borrowerType: "PERSON" | "COMPANY";
  principalAmount: number;
  interestRate: number;
  interestType?: LoanInterestType;
  frequency: LoanFrequency;
  totalInstallments: number;
  startDate: string;
  notes?: string | null;
};

type ScheduleComputation = {
  installment_number: number;
  due_date: string;
  expected_amount: number;
  expected_principal: number;
  expected_interest: number;
};

function computeLoanSchedule(
  loan: LoanRecord,
  overrides?: { totalInstallments?: number; startDate?: string; interestRate?: number; frequency?: LoanFrequency }
): ScheduleComputation[] {
  const totalInstallments = overrides?.totalInstallments ?? loan.total_installments;
  const frequency = overrides?.frequency ?? loan.frequency;
  const startDate = overrides?.startDate ?? loan.start_date;
  const interestRate = overrides?.interestRate ?? loan.interest_rate;

  if (!totalInstallments || totalInstallments <= 0) {
    throw new Error("El número total de cuotas debe ser mayor a cero");
  }

  const principal = loan.principal_amount;
  const rateDecimal = interestRate / 100;
  const simpleInterestTotal = principal * rateDecimal;
  const totalAmount = principal + simpleInterestTotal;
  const basePrincipal = principal / totalInstallments;
  const baseInterest = simpleInterestTotal / totalInstallments;

  let remainingPrincipal = principal;
  let interestAccum = 0;
  let amountAccum = 0;
  const schedule: ScheduleComputation[] = [];
  const baseDate = dayjs(startDate ?? loan.start_date);

  for (let i = 0; i < totalInstallments; i += 1) {
    const installmentNumber = i + 1;
    const isLast = installmentNumber === totalInstallments;

    let principalShare = roundCurrency(isLast ? remainingPrincipal : basePrincipal);
    remainingPrincipal = roundCurrency(remainingPrincipal - principalShare);

    let interestShare = roundCurrency(isLast ? simpleInterestTotal - interestAccum : baseInterest);
    interestAccum = roundCurrency(interestAccum + interestShare);

    let amountShare = roundCurrency(principalShare + interestShare);
    if (isLast) {
      const expectedTotal = roundCurrency(totalAmount);
      amountShare = roundCurrency(expectedTotal - amountAccum);
    }
    amountAccum = roundCurrency(amountAccum + amountShare);

    let dueDate = baseDate;
    if (frequency === "WEEKLY") {
      dueDate = baseDate.add(i, "week");
    } else if (frequency === "BIWEEKLY") {
      dueDate = baseDate.add(i * 2, "week");
    } else {
      dueDate = baseDate.add(i, "month");
    }

    schedule.push({
      installment_number: installmentNumber,
      due_date: formatLocalDateForMySQL(dueDate.toDate()),
      expected_amount: amountShare,
      expected_principal: principalShare,
      expected_interest: interestShare,
    });
  }

  return schedule;
}

async function insertScheduleEntries(connection: mysql.PoolConnection | Pool, loanId: number, schedule: ScheduleComputation[]) {
  if (!schedule.length) return;
  const values = schedule.map((entry) => [
    loanId,
    entry.installment_number,
    entry.due_date,
    entry.expected_amount,
    entry.expected_principal,
    entry.expected_interest,
  ]);

  await connection.query<ResultSetHeader>(
    `INSERT INTO loan_schedules
      (loan_id, installment_number, due_date, expected_amount, expected_principal, expected_interest)
     VALUES ?`,
    [values]
  );
}

async function refreshLoanStatus(connection: mysql.PoolConnection | Pool, loanId: number) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN status IN ('PENDING','PARTIAL','OVERDUE') THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'OVERDUE' THEN 1 ELSE 0 END) AS overdue_count
     FROM loan_schedules
     WHERE loan_id = ?`,
    [loanId]
  );

  const row = rows[0] ?? { paid_count: 0, pending_count: 0, overdue_count: 0 };
  let nextStatus: LoanStatus = "ACTIVE";
  if (Number(row.pending_count ?? 0) === 0) {
    nextStatus = "COMPLETED";
  } else if (Number(row.overdue_count ?? 0) > 0) {
    nextStatus = "DEFAULTED";
  }

  await connection.query(
    `UPDATE loans SET status = ?, updated_at = NOW() WHERE id = ? LIMIT 1`,
    [nextStatus, loanId]
  );
}

export async function createLoan(payload: CreateLoanPayload): Promise<LoanRecord> {
  const pool = getPool();
  const publicId = randomUUID();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO loans
      (public_id, title, borrower_name, borrower_type, principal_amount, interest_rate, interest_type, frequency, total_installments, start_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)` as string,
    [
      publicId,
      payload.title,
      payload.borrowerName,
      payload.borrowerType,
      payload.principalAmount,
      payload.interestRate,
      payload.interestType ?? 'SIMPLE',
      payload.frequency,
      payload.totalInstallments,
      payload.startDate,
      payload.notes ?? null,
    ]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM loans WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return mapLoanRow(rows[0]);
}

export async function listLoansWithSummary(): Promise<LoanWithSummary[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
        l.*,
        COALESCE(SUM(ls.expected_amount), 0) AS total_expected,
        COALESCE(SUM(CASE WHEN ls.status = 'PAID' THEN COALESCE(ls.paid_amount, ls.expected_amount) ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN ls.status IN ('PENDING','PARTIAL','OVERDUE') THEN ls.expected_amount ELSE 0 END), 0) AS remaining_amount,
        COALESCE(SUM(CASE WHEN ls.status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid_installments,
        COALESCE(SUM(CASE WHEN ls.status IN ('PENDING','PARTIAL','OVERDUE') THEN 1 ELSE 0 END), 0) AS pending_installments
      FROM loans l
      LEFT JOIN loan_schedules ls ON ls.loan_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC`
  );

  return rows.map((row) => {
    const loan = mapLoanRow(row);
    return {
      ...loan,
      total_expected: Number(row.total_expected ?? 0),
      total_paid: Number(row.total_paid ?? 0),
      remaining_amount: Number(row.remaining_amount ?? 0),
      paid_installments: Number(row.paid_installments ?? 0),
      pending_installments: Number(row.pending_installments ?? 0),
    } satisfies LoanWithSummary;
  });
}

export async function getLoanDetail(publicId: string): Promise<{
  loan: LoanRecord;
  schedules: LoanScheduleWithTransaction[];
  summary: {
    total_expected: number;
    total_paid: number;
    remaining_amount: number;
    paid_installments: number;
    pending_installments: number;
  };
} | null> {
  const pool = getPool();
  const [loanRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM loans WHERE public_id = ? LIMIT 1`,
    [publicId]
  );

  if (!loanRows.length) return null;
  const loan = mapLoanRow(loanRows[0]);

  const [scheduleRows] = await pool.query<RowDataPacket[]>(
    `SELECT ls.*, t.description AS transaction_description, t.timestamp AS transaction_timestamp, t.amount AS transaction_amount
       FROM loan_schedules ls
       LEFT JOIN mp_transactions t ON t.id = ls.transaction_id
      WHERE ls.loan_id = ?
      ORDER BY ls.installment_number ASC`,
    [loan.id]
  );

  const schedules: LoanScheduleWithTransaction[] = scheduleRows.map((row) => {
    const base = mapLoanScheduleRow(row);
    const transaction = row.transaction_id
      ? {
          id: Number(row.transaction_id),
          description: row.transaction_description != null ? String(row.transaction_description) : null,
          timestamp:
            row.transaction_timestamp instanceof Date
              ? row.transaction_timestamp.toISOString()
              : row.transaction_timestamp
              ? String(row.transaction_timestamp)
              : "",
          amount: row.transaction_amount != null ? Number(row.transaction_amount) : null,
        }
      : null;
    return { ...base, transaction } satisfies LoanScheduleWithTransaction;
  });

  const today = dayjs().startOf("day");
  const overdueIds: number[] = [];
  const normalizedSchedules = schedules.map((schedule) => {
    if (schedule.status === "PENDING" && dayjs(schedule.due_date).isBefore(today)) {
      overdueIds.push(schedule.id);
      return { ...schedule, status: "OVERDUE" as const };
    }
    return schedule;
  });

  if (overdueIds.length) {
    await pool.query(
      `UPDATE loan_schedules SET status = 'OVERDUE', updated_at = NOW() WHERE id IN (?) AND status = 'PENDING'`,
      [overdueIds]
    );
    await refreshLoanStatus(pool, loan.id);
  }

  const summary = normalizedSchedules.reduce(
    (acc, schedule) => {
      acc.total_expected = roundCurrency(acc.total_expected + schedule.expected_amount);
      const paidAmount = schedule.status === 'PAID' || schedule.status === 'PARTIAL'
        ? schedule.paid_amount ?? schedule.expected_amount
        : 0;
      acc.total_paid = roundCurrency(acc.total_paid + (paidAmount ?? 0));
      if (schedule.status === 'PAID') {
        acc.paid_installments += 1;
      } else {
        acc.pending_installments += 1;
        acc.remaining_amount = roundCurrency(acc.remaining_amount + schedule.expected_amount);
      }
      return acc;
    },
    {
      total_expected: 0,
      total_paid: 0,
      remaining_amount: 0,
      paid_installments: 0,
      pending_installments: 0,
    }
  );

  return { loan, schedules: normalizedSchedules, summary };
}

export async function regenerateLoanSchedule(
  publicId: string,
  options?: { totalInstallments?: number; startDate?: string; interestRate?: number; frequency?: LoanFrequency }
) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [loanRows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM loans WHERE public_id = ? LIMIT 1 FOR UPDATE`,
      [publicId]
    );
    if (!loanRows.length) {
      throw new Error("Préstamo no encontrado");
    }
    const loan = mapLoanRow(loanRows[0]);

    const schedule = computeLoanSchedule(loan, options);
    await connection.query(`DELETE FROM loan_schedules WHERE loan_id = ?`, [loan.id]);
    await insertScheduleEntries(connection, loan.id, schedule);
    await refreshLoanStatus(connection, loan.id);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function markLoanSchedulePayment(payload: {
  scheduleId: number;
  transactionId: number;
  paidAmount: number;
  paidDate: string;
}): Promise<LoanScheduleWithTransaction> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [scheduleRows] = await connection.query<RowDataPacket[]>(
      `SELECT ls.*, l.public_id FROM loan_schedules ls JOIN loans l ON l.id = ls.loan_id WHERE ls.id = ? FOR UPDATE`,
      [payload.scheduleId]
    );
    if (!scheduleRows.length) {
      throw new Error("Cuota no encontrada");
    }
    const schedule = mapLoanScheduleRow(scheduleRows[0]);

    const [transactionRows] = await connection.query<RowDataPacket[]>(
      `SELECT id, amount, timestamp FROM mp_transactions WHERE id = ? LIMIT 1`,
      [payload.transactionId]
    );
    if (!transactionRows.length) {
      throw new Error("Transacción no encontrada");
    }

    const paidAmount = roundCurrency(payload.paidAmount);
    const status = paidAmount >= schedule.expected_amount ? 'PAID' : 'PARTIAL';

    await connection.query(
      `UPDATE loan_schedules
          SET transaction_id = ?, paid_amount = ?, paid_date = ?, status = ?, updated_at = NOW()
        WHERE id = ?
        LIMIT 1`,
      [payload.transactionId, paidAmount, payload.paidDate, status, payload.scheduleId]
    );

    await refreshLoanStatus(connection, schedule.loan_id);

    const [updatedRows] = await connection.query<RowDataPacket[]>(
      `SELECT ls.*, t.description AS transaction_description, t.timestamp AS transaction_timestamp, t.amount AS transaction_amount
         FROM loan_schedules ls
         LEFT JOIN mp_transactions t ON t.id = ls.transaction_id
        WHERE ls.id = ?
        LIMIT 1`,
      [payload.scheduleId]
    );

    await connection.commit();
    if (!updatedRows.length) {
      throw new Error("No se pudo recuperar la cuota actualizada");
    }
    const updatedRow = updatedRows[0];
    const mapped = mapLoanScheduleRow(updatedRow);
    const transaction = updatedRow.transaction_id
      ? {
          id: Number(updatedRow.transaction_id),
          description: updatedRow.transaction_description != null ? String(updatedRow.transaction_description) : null,
          timestamp:
            updatedRow.transaction_timestamp instanceof Date
              ? updatedRow.transaction_timestamp.toISOString()
              : updatedRow.transaction_timestamp
              ? String(updatedRow.transaction_timestamp)
              : "",
          amount: updatedRow.transaction_amount != null ? Number(updatedRow.transaction_amount) : null,
        }
      : null;
    return { ...mapped, transaction } satisfies LoanScheduleWithTransaction;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function unlinkLoanSchedulePayment(scheduleId: number): Promise<LoanScheduleWithTransaction> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT id, loan_id FROM loan_schedules WHERE id = ? FOR UPDATE`,
      [scheduleId]
    );
    if (!rows.length) {
      throw new Error("Cuota no encontrada");
    }
    const loanId = Number(rows[0].loan_id);
    await connection.query(
      `UPDATE loan_schedules
          SET transaction_id = NULL, paid_amount = NULL, paid_date = NULL, status = 'PENDING', updated_at = NOW()
        WHERE id = ?
        LIMIT 1`,
      [scheduleId]
    );
    await refreshLoanStatus(connection, loanId);

    const [updatedRows] = await connection.query<RowDataPacket[]>(
      `SELECT ls.*, NULL AS transaction_description, NULL AS transaction_timestamp, NULL AS transaction_amount
         FROM loan_schedules ls
        WHERE ls.id = ?
        LIMIT 1`,
      [scheduleId]
    );

    await connection.commit();
    if (!updatedRows.length) {
      throw new Error("No se pudo recuperar la cuota actualizada");
    }
    const mapped = mapLoanScheduleRow(updatedRows[0]);
    return { ...mapped, transaction: null } satisfies LoanScheduleWithTransaction;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export type CreateServicePayload = {
  name: string;
  detail?: string | null;
  category?: string | null;
  serviceType: ServiceType;
  ownership?: ServiceOwnership;
  obligationType?: ServiceObligationType;
  recurrenceType?: ServiceRecurrenceType;
  frequency: ServiceFrequency;
  defaultAmount: number;
  amountIndexation?: ServiceAmountIndexation;
  counterpartId?: number | null;
  counterpartAccountId?: number | null;
  accountReference?: string | null;
  emissionDay?: number | null;
  emissionMode?: ServiceEmissionMode;
  emissionStartDay?: number | null;
  emissionEndDay?: number | null;
  emissionExactDate?: string | null;
  dueDay?: number | null;
  startDate: string;
  monthsToGenerate?: number;
  lateFeeMode?: ServiceLateFeeMode;
  lateFeeValue?: number | null;
  lateFeeGraceDays?: number | null;
  notes?: string | null;
};

type ServiceScheduleComputation = {
  period_start: string;
  period_end: string;
  due_date: string;
  expected_amount: number;
};

const FREQUENCY_CONFIG: Record<ServiceFrequency, { unit: dayjs.ManipulateType; amount: number }> = {
  WEEKLY: { unit: "week", amount: 1 },
  BIWEEKLY: { unit: "week", amount: 2 },
  MONTHLY: { unit: "month", amount: 1 },
  BIMONTHLY: { unit: "month", amount: 2 },
  QUARTERLY: { unit: "month", amount: 3 },
  SEMIANNUAL: { unit: "month", amount: 6 },
  ANNUAL: { unit: "year", amount: 1 },
  ONCE: { unit: "month", amount: 1 },
};

function computeServiceSchedule(
  service: ServiceRecord,
  overrides?: { months?: number; startDate?: string; defaultAmount?: number; dueDay?: number | null; emissionDay?: number | null; frequency?: ServiceFrequency }
): ServiceScheduleComputation[] {
  const config = FREQUENCY_CONFIG[overrides?.frequency ?? service.frequency];
  if (!config) {
    throw new Error("Frecuencia de servicio no soportada");
  }

  const rawPeriods = overrides?.months ?? service.next_generation_months;
  const totalPeriods = (overrides?.frequency ?? service.frequency) === "ONCE" || service.recurrence_type === "ONE_OFF"
    ? Math.min(rawPeriods, 1)
    : rawPeriods;
  const baseAmount = overrides?.defaultAmount ?? service.default_amount;
  if (totalPeriods <= 0) return [];

  const schedule: ServiceScheduleComputation[] = [];
  let cursor = dayjs(overrides?.startDate ?? service.start_date).startOf("day");
  const dueDay = overrides?.dueDay ?? service.due_day ?? null;

  for (let i = 0; i < totalPeriods; i += 1) {
    const periodStart = cursor;
    const periodEnd = cursor.add(config.amount, config.unit).subtract(1, "day");
    let dueDate = periodEnd;
    if (config.unit === "month" || config.unit === "year") {
      if (dueDay != null) {
        const candidate = periodStart.startOf("month").date(dueDay);
        if (candidate.month() !== periodStart.month()) {
          dueDate = periodStart.endOf("month");
        } else {
          dueDate = candidate;
        }
      }
    }

    schedule.push({
      period_start: formatLocalDateForMySQL(periodStart.toDate()),
      period_end: formatLocalDateForMySQL(periodEnd.toDate()),
      due_date: formatLocalDateForMySQL(dueDate.toDate()),
      expected_amount: roundCurrency(baseAmount),
    });

    cursor = periodEnd.add(1, "day");
  }

  return schedule;
}

async function insertServiceScheduleEntries(
  connection: mysql.PoolConnection | Pool,
  serviceId: number,
  schedule: ServiceScheduleComputation[]
) {
  if (!schedule.length) return;
  const values = schedule.map((entry) => [
    serviceId,
    entry.period_start,
    entry.period_end,
    entry.due_date,
    entry.expected_amount,
  ]);

  await connection.query<ResultSetHeader>(
    `INSERT INTO service_schedules (service_id, period_start, period_end, due_date, expected_amount) VALUES ?`,
    [values]
  );
}

async function refreshServiceStatus(connection: mysql.PoolConnection | Pool, serviceId: number) {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN status IN ('PENDING','PARTIAL','SKIPPED') THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'PENDING' AND due_date < CURDATE() THEN 1 ELSE 0 END) AS overdue_count
     FROM service_schedules
     WHERE service_id = ?`,
    [serviceId]
  );

  const row = rows[0] ?? { paid_count: 0, pending_count: 0, overdue_count: 0 };
  let status: ServiceStatus = "ACTIVE";
  if (Number(row.pending_count ?? 0) === 0) {
    status = "INACTIVE";
  } else if (Number(row.overdue_count ?? 0) > 0) {
    status = "ACTIVE";
  }

  await connection.query(
    `UPDATE services SET status = ?, updated_at = NOW() WHERE id = ? LIMIT 1`,
    [status, serviceId]
  );
}

export async function createService(payload: CreateServicePayload): Promise<ServiceRecord> {
  const pool = getPool();
  const publicId = randomUUID();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO services
      (
        public_id,
        name,
        detail,
        category,
        service_type,
        ownership,
        obligation_type,
        recurrence_type,
        frequency,
        default_amount,
        amount_indexation,
        counterpart_id,
        counterpart_account_id,
        account_reference,
        emission_day,
        emission_mode,
        emission_start_day,
        emission_end_day,
        emission_exact_date,
        due_day,
        start_date,
        next_generation_months,
        late_fee_mode,
        late_fee_value,
        late_fee_grace_days,
        status,
        notes
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)` as string,
    [
      publicId,
      payload.name,
      payload.detail ?? null,
      payload.category ?? null,
      payload.serviceType,
      payload.ownership ?? "COMPANY",
      payload.obligationType ?? "SERVICE",
      payload.recurrenceType ?? "RECURRING",
      payload.frequency,
      payload.defaultAmount,
      payload.amountIndexation ?? "NONE",
      payload.counterpartId ?? null,
      payload.counterpartAccountId ?? null,
      payload.accountReference ?? null,
      payload.emissionDay ?? null,
      payload.emissionMode ?? "FIXED_DAY",
      payload.emissionStartDay ?? null,
      payload.emissionEndDay ?? null,
      payload.emissionExactDate ?? null,
      payload.dueDay ?? null,
      payload.startDate,
      (payload.frequency === "ONCE" || payload.recurrenceType === "ONE_OFF")
        ? 1
        : payload.monthsToGenerate ?? 12,
      payload.lateFeeMode ?? "NONE",
      payload.lateFeeValue ?? null,
      payload.lateFeeGraceDays ?? null,
      payload.notes ?? null,
    ]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
        s.*,
        c.name AS counterpart_name,
        ca.account_identifier AS counterpart_account_identifier,
        ca.bank_name AS counterpart_account_bank_name,
        ca.account_type AS counterpart_account_type
      FROM services s
      LEFT JOIN mp_counterparts c ON c.id = s.counterpart_id
      LEFT JOIN mp_counterpart_accounts ca ON ca.id = s.counterpart_account_id
     WHERE s.id = ?
     LIMIT 1`,
    [result.insertId]
  );
  return mapServiceRow(rows[0]);
}

export async function updateService(publicId: string, payload: CreateServicePayload): Promise<ServiceRecord> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM services WHERE public_id = ? LIMIT 1`,
    [publicId]
  );
  if (!rows.length) {
    throw new Error("Servicio no encontrado");
  }
  const current = mapServiceRow(rows[0]);

  const nextGenerationMonths =
    payload.monthsToGenerate ?? current.next_generation_months;

  await pool.query(
    `UPDATE services SET
      name = ?,
      detail = ?,
      category = ?,
      service_type = ?,
      ownership = ?,
      obligation_type = ?,
      recurrence_type = ?,
      frequency = ?,
      default_amount = ?,
      amount_indexation = ?,
      counterpart_id = ?,
      counterpart_account_id = ?,
      account_reference = ?,
      emission_day = ?,
      emission_mode = ?,
      emission_start_day = ?,
      emission_end_day = ?,
      emission_exact_date = ?,
      due_day = ?,
      start_date = ?,
      next_generation_months = ?,
      late_fee_mode = ?,
      late_fee_value = ?,
      late_fee_grace_days = ?,
      notes = ?,
      updated_at = NOW()
     WHERE public_id = ?
     LIMIT 1` as string,
    [
      payload.name,
      payload.detail ?? null,
      payload.category ?? null,
      payload.serviceType,
      payload.ownership ?? current.ownership,
      payload.obligationType ?? current.obligation_type,
      payload.recurrenceType ?? current.recurrence_type,
      payload.frequency,
      payload.defaultAmount,
      payload.amountIndexation ?? current.amount_indexation,
      payload.counterpartId ?? null,
      payload.counterpartAccountId ?? null,
      payload.accountReference ?? null,
      payload.emissionMode === "FIXED_DAY" ? payload.emissionDay ?? null : null,
      payload.emissionMode ?? current.emission_mode,
      payload.emissionMode === "DATE_RANGE" ? payload.emissionStartDay ?? null : null,
      payload.emissionMode === "DATE_RANGE" ? payload.emissionEndDay ?? null : null,
      payload.emissionMode === "SPECIFIC_DATE" ? payload.emissionExactDate ?? null : null,
      payload.dueDay ?? null,
      payload.startDate,
      nextGenerationMonths,
      payload.lateFeeMode ?? current.late_fee_mode,
      payload.lateFeeMode === "NONE" ? null : payload.lateFeeValue ?? null,
      payload.lateFeeMode === "NONE" ? null : payload.lateFeeGraceDays ?? null,
      payload.notes ?? null,
      publicId,
    ]
  );

  const [updatedRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM services WHERE public_id = ? LIMIT 1`,
    [publicId]
  );
  if (!updatedRows.length) {
    throw new Error("Servicio no encontrado");
  }
  return mapServiceRow(updatedRows[0]);
}

export async function listServicesWithSummary(): Promise<ServiceWithSummary[]> {
  const pool = getPool();
  
  const { sql, params } = new SQLBuilder("services s")
    .select(
      "s.*",
      "ANY_VALUE(c.name) AS counterpart_name",
      "ANY_VALUE(ca.account_identifier) AS counterpart_account_identifier",
      "ANY_VALUE(ca.bank_name) AS counterpart_account_bank_name",
      "ANY_VALUE(ca.account_type) AS counterpart_account_type",
      "COALESCE(SUM(ss.expected_amount),0) AS total_expected",
      "COALESCE(SUM(CASE WHEN ss.status IN ('PAID','PARTIAL') THEN COALESCE(ss.paid_amount, ss.expected_amount) ELSE 0 END),0) AS total_paid",
      "COALESCE(SUM(CASE WHEN ss.status IN ('PENDING','PARTIAL') THEN 1 ELSE 0 END),0) AS pending_count",
      "COALESCE(SUM(CASE WHEN ss.status = 'PENDING' AND ss.due_date < CURDATE() THEN 1 ELSE 0 END),0) AS overdue_count"
    )
    .leftJoin("service_schedules ss", "ss.service_id = s.id")
    .leftJoin("mp_counterparts c", "c.id = s.counterpart_id")
    .leftJoin("mp_counterpart_accounts ca", "ca.id = s.counterpart_account_id")
    .build();
  
  // Agregar GROUP BY y ORDER BY que no están soportados en el builder básico
  const finalSql = sql + " GROUP BY s.id ORDER BY s.created_at DESC";
  
  const rows = await selectMany<RowDataPacket>(pool, finalSql, params);

  return rows.map((row) => {
    const service = mapServiceRow(row);
    return {
      ...service,
      total_expected: Number(row.total_expected ?? 0),
      total_paid: Number(row.total_paid ?? 0),
      pending_count: Number(row.pending_count ?? 0),
      overdue_count: Number(row.overdue_count ?? 0),
    } satisfies ServiceWithSummary;
  });
}

export async function getServiceDetail(publicId: string): Promise<{
  service: ServiceWithSummary;
  schedules: ServiceScheduleWithTransaction[];
} | null> {
  const pool = getPool();
  const [serviceRows] = await pool.query<RowDataPacket[]>(
    `SELECT
        s.*,
        c.name AS counterpart_name,
        ca.account_identifier AS counterpart_account_identifier,
        ca.bank_name AS counterpart_account_bank_name,
        ca.account_type AS counterpart_account_type
      FROM services s
      LEFT JOIN mp_counterparts c ON c.id = s.counterpart_id
      LEFT JOIN mp_counterpart_accounts ca ON ca.id = s.counterpart_account_id
     WHERE s.public_id = ?
     LIMIT 1`,
    [publicId]
  );
  if (!serviceRows.length) return null;
  const service = mapServiceRow(serviceRows[0]);

  const [scheduleRows] = await pool.query<RowDataPacket[]>(
    `SELECT ss.*, t.description AS transaction_description, t.timestamp AS transaction_timestamp, t.amount AS transaction_amount
       FROM service_schedules ss
       LEFT JOIN mp_transactions t ON t.id = ss.transaction_id
      WHERE ss.service_id = ?
      ORDER BY ss.period_start ASC`,
    [service.id]
  );

  const schedules: ServiceScheduleWithTransaction[] = scheduleRows.map((row) => {
    const base = mapServiceScheduleRow(row);
    const transaction = row.transaction_id
      ? {
          id: Number(row.transaction_id),
          description: row.transaction_description != null ? String(row.transaction_description) : null,
          timestamp:
            row.transaction_timestamp instanceof Date
              ? row.transaction_timestamp.toISOString()
              : row.transaction_timestamp
              ? String(row.transaction_timestamp)
              : "",
          amount: row.transaction_amount != null ? Number(row.transaction_amount) : null,
        }
      : null;
    return applyDerivedScheduleAmounts(service, { ...base, transaction });
  });

  const aggregates = schedules.reduce(
    (acc, schedule) => {
      acc.totalExpected += schedule.expected_amount;
      if (["PAID", "PARTIAL"].includes(schedule.status)) {
        acc.totalPaid += schedule.paid_amount != null ? schedule.paid_amount : schedule.expected_amount;
      }
      if (["PENDING", "PARTIAL"].includes(schedule.status)) {
        acc.pendingCount += 1;
        if (schedule.status === "PENDING" && dayjs(schedule.due_date).isBefore(dayjs().startOf("day"))) {
          acc.overdueCount += 1;
        }
      }
      return acc;
    },
    {
      totalExpected: 0,
      totalPaid: 0,
      pendingCount: 0,
      overdueCount: 0,
    }
  );

  const serviceWithSummary: ServiceWithSummary = {
    ...service,
    total_expected: roundCurrency(aggregates.totalExpected),
    total_paid: roundCurrency(aggregates.totalPaid),
    pending_count: aggregates.pendingCount,
    overdue_count: aggregates.overdueCount,
  };

  return { service: serviceWithSummary, schedules };
}

export async function regenerateServiceSchedule(
  publicId: string,
  overrides?: { months?: number; startDate?: string; defaultAmount?: number; dueDay?: number | null; frequency?: ServiceFrequency; emissionDay?: number | null }
) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [serviceRows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM services WHERE public_id = ? LIMIT 1 FOR UPDATE`,
      [publicId]
    );
    if (!serviceRows.length) {
      throw new Error("Servicio no encontrado");
    }
    const service = mapServiceRow(serviceRows[0]);
    const schedule = computeServiceSchedule(service, overrides);
    await connection.query(`DELETE FROM service_schedules WHERE service_id = ?`, [service.id]);
    await insertServiceScheduleEntries(connection, service.id, schedule);
    await refreshServiceStatus(connection, service.id);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function markServicePayment(payload: {
  scheduleId: number;
  transactionId: number;
  paidAmount: number;
  paidDate: string;
  note?: string | null;
}): Promise<ServiceScheduleWithTransaction> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM service_schedules WHERE id = ? FOR UPDATE`,
      [payload.scheduleId]
    );
    if (!rows.length) throw new Error("Periodo no encontrado");
    const schedule = mapServiceScheduleRow(rows[0]);
    const service = await fetchServiceRecordById(connection, schedule.service_id);
    const derivedBefore = applyDerivedScheduleAmounts(service, { ...schedule, transaction: null });

    const [txRows] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM mp_transactions WHERE id = ? LIMIT 1`,
      [payload.transactionId]
    );
    if (!txRows.length) throw new Error("Transacción no encontrada");

    const paidAmount = roundCurrency(payload.paidAmount);
    const targetAmount = derivedBefore.effective_amount;
    const status = paidAmount >= targetAmount ? 'PAID' : 'PARTIAL';

    await connection.query(
      `UPDATE service_schedules
          SET transaction_id = ?, paid_amount = ?, paid_date = ?, note = ?, status = ?, updated_at = NOW()
        WHERE id = ? LIMIT 1`,
      [payload.transactionId, paidAmount, payload.paidDate, payload.note ?? null, status, payload.scheduleId]
    );

    await refreshServiceStatus(connection, schedule.service_id);

    const [updatedRows] = await connection.query<RowDataPacket[]>(
      `SELECT ss.*, t.description AS transaction_description, t.timestamp AS transaction_timestamp, t.amount AS transaction_amount
         FROM service_schedules ss
         LEFT JOIN mp_transactions t ON t.id = ss.transaction_id
        WHERE ss.id = ?
        LIMIT 1`,
      [payload.scheduleId]
    );

    await connection.commit();
    if (!updatedRows.length) throw new Error("No se pudo recuperar el periodo");
    const mapped = mapServiceScheduleRow(updatedRows[0]);
    const transaction = updatedRows[0].transaction_id
      ? {
          id: Number(updatedRows[0].transaction_id),
          description: updatedRows[0].transaction_description != null ? String(updatedRows[0].transaction_description) : null,
          timestamp:
            updatedRows[0].transaction_timestamp instanceof Date
              ? updatedRows[0].transaction_timestamp.toISOString()
              : updatedRows[0].transaction_timestamp
              ? String(updatedRows[0].transaction_timestamp)
              : "",
          amount: updatedRows[0].transaction_amount != null ? Number(updatedRows[0].transaction_amount) : null,
        }
      : null;
    return applyDerivedScheduleAmounts(service, { ...mapped, transaction });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function unlinkServicePayment(scheduleId: number): Promise<ServiceScheduleWithTransaction> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM service_schedules WHERE id = ? FOR UPDATE`,
      [scheduleId]
    );
    if (!rows.length) throw new Error("Periodo no encontrado");
    const schedule = mapServiceScheduleRow(rows[0]);
    const service = await fetchServiceRecordById(connection, schedule.service_id);

    await connection.query(
      `UPDATE service_schedules
          SET transaction_id = NULL, paid_amount = NULL, paid_date = NULL, note = NULL, status = 'PENDING', updated_at = NOW()
        WHERE id = ? LIMIT 1`,
      [scheduleId]
    );
    await refreshServiceStatus(connection, schedule.service_id);

    const [updatedRows] = await connection.query<RowDataPacket[]>(
      `SELECT ss.*, NULL AS transaction_description, NULL AS transaction_timestamp, NULL AS transaction_amount
         FROM service_schedules ss
        WHERE ss.id = ?
        LIMIT 1`,
      [scheduleId]
    );
    await connection.commit();
    if (!updatedRows.length) throw new Error("No se pudo recuperar el periodo");
    const mapped = mapServiceScheduleRow(updatedRows[0]);
    return applyDerivedScheduleAmounts(service, { ...mapped, transaction: null });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listMonthlyExpenses(filters?: {
  from?: string;
  to?: string;
  status?: ("OPEN" | "CLOSED")[];
  serviceId?: number | null;
}): Promise<MonthlyExpenseRecord[]> {
  const pool = getPool();
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (filters?.from) {
    conditions.push("me.expense_date >= ?");
    params.push(filters.from);
  }
  if (filters?.to) {
    conditions.push("me.expense_date <= ?");
    params.push(filters.to);
  }
  if (filters?.status && filters.status.length) {
    conditions.push(`me.status IN (${filters.status.map(() => "?").join(", ")})`);
    params.push(...filters.status);
  }
  if (typeof filters?.serviceId === "number") {
    conditions.push("me.service_id = ?");
    params.push(filters.serviceId);
  } else if (filters?.serviceId === null) {
    conditions.push("me.service_id IS NULL");
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT me.*, COALESCE(SUM(met.amount), 0) AS amount_applied, COUNT(met.transaction_id) AS transaction_count
       FROM monthly_expenses me
       LEFT JOIN monthly_expense_transactions met ON met.monthly_expense_id = me.id
       ${whereClause}
       GROUP BY me.id
       ORDER BY me.expense_date DESC, me.id DESC`,
    params
  );
  return rows.map(mapMonthlyExpenseRow);
}

export async function getMonthlyExpenseDetail(publicId: string): Promise<MonthlyExpenseDetail | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT me.*, COALESCE(SUM(met.amount), 0) AS amount_applied, COUNT(met.transaction_id) AS transaction_count
       FROM monthly_expenses me
       LEFT JOIN monthly_expense_transactions met ON met.monthly_expense_id = me.id
      WHERE me.public_id = ?
      GROUP BY me.id
      LIMIT 1`,
    [publicId]
  );
  if (!rows.length) return null;
  const expense = mapMonthlyExpenseRow(rows[0]);
  const [transactions] = await pool.query<RowDataPacket[]>(
    `SELECT met.transaction_id, met.amount, t.timestamp, t.description, t.direction
       FROM monthly_expense_transactions met
       LEFT JOIN mp_transactions t ON t.id = met.transaction_id
      WHERE met.monthly_expense_id = ?
      ORDER BY t.timestamp DESC`,
    [expense.id]
  );
  return {
    ...expense,
    transactions: transactions.map((row) => ({
      transaction_id: Number(row.transaction_id),
      amount: Number(row.amount ?? 0),
      timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp ? String(row.timestamp) : "",
      description: row.description != null ? String(row.description) : null,
      direction: row.direction != null ? String(row.direction) : "",
    })),
  } satisfies MonthlyExpenseDetail;
}

export async function createMonthlyExpense(payload: CreateMonthlyExpensePayload): Promise<MonthlyExpenseRecord> {
  const pool = getPool();
  const publicId = randomUUID();
  const tags = payload.tags ? JSON.stringify(payload.tags) : null;
  const source = payload.source ?? "MANUAL";
  const status = payload.status ?? "OPEN";
  await pool.query(
    `INSERT INTO monthly_expenses (public_id, name, category, amount_expected, expense_date, notes, source, service_id, tags, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      publicId,
      payload.name,
      payload.category ?? null,
      payload.amountExpected,
      payload.expenseDate,
      payload.notes ?? null,
      source,
      payload.serviceId ?? null,
      tags,
      status,
    ]
  );
  const detail = await getMonthlyExpenseDetail(publicId);
  if (!detail) {
    throw new Error("No se pudo crear el gasto mensual");
  }
  return detail;
}

export async function updateMonthlyExpense(publicId: string, payload: CreateMonthlyExpensePayload): Promise<MonthlyExpenseRecord> {
  const pool = getPool();
  const tags = payload.tags ? JSON.stringify(payload.tags) : null;
  const source = payload.source ?? "MANUAL";
  const status = payload.status ?? "OPEN";
  await pool.query(
    `UPDATE monthly_expenses
        SET name = ?,
            category = ?,
            amount_expected = ?,
            expense_date = ?,
            notes = ?,
            source = ?,
            service_id = ?,
            tags = ?,
            status = ?,
            updated_at = NOW()
      WHERE public_id = ?
      LIMIT 1`,
    [
      payload.name,
      payload.category ?? null,
      payload.amountExpected,
      payload.expenseDate,
      payload.notes ?? null,
      source,
      payload.serviceId ?? null,
      tags,
      status,
      publicId,
    ]
  );
  const detail = await getMonthlyExpenseDetail(publicId);
  if (!detail) {
    throw new Error("Gasto mensual no encontrado");
  }
  return detail;
}

export async function linkMonthlyExpenseTransaction(
  publicId: string,
  payload: LinkMonthlyExpenseTransactionPayload
): Promise<MonthlyExpenseDetail> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM monthly_expenses WHERE public_id = ? LIMIT 1`,
    [publicId]
  );
  if (!rows.length) throw new Error("Gasto mensual no encontrado");
  const expenseId = Number(rows[0].id);

  const [txRows] = await pool.query<RowDataPacket[]>(
    `SELECT amount FROM mp_transactions WHERE id = ? LIMIT 1`,
    [payload.transactionId]
  );
  if (!txRows.length) throw new Error("Transacción no encontrada");
  const txAmount = Number(txRows[0].amount ?? 0);
  const amount = payload.amount != null ? payload.amount : Math.abs(txAmount);

  await pool.query(
    `INSERT INTO monthly_expense_transactions (monthly_expense_id, transaction_id, amount)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE amount = VALUES(amount)` as string,
    [expenseId, payload.transactionId, amount]
  );

  const detail = await getMonthlyExpenseDetail(publicId);
  if (!detail) throw new Error("Gasto mensual no encontrado");
  return detail;
}

export async function unlinkMonthlyExpenseTransaction(
  publicId: string,
  transactionId: number
): Promise<MonthlyExpenseDetail> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM monthly_expenses WHERE public_id = ? LIMIT 1`,
    [publicId]
  );
  if (!rows.length) throw new Error("Gasto mensual no encontrado");
  const expenseId = Number(rows[0].id);

  await pool.query(
    `DELETE FROM monthly_expense_transactions WHERE monthly_expense_id = ? AND transaction_id = ? LIMIT 1` as string,
    [expenseId, transactionId]
  );

  const detail = await getMonthlyExpenseDetail(publicId);
  if (!detail) throw new Error("Gasto mensual no encontrado");
  return detail;
}

export async function getMonthlyExpenseStats(options: {
  from?: string;
  to?: string;
  groupBy?: "day" | "week" | "month" | "quarter" | "year";
  category?: string | null;
}): Promise<
  Array<{
    period: string;
    total_expected: number;
    total_applied: number;
    expense_count: number;
  }>
> {
  const pool = getPool();
  const groupBy = options.groupBy ?? "month";
  let expr = "DATE_FORMAT(me.expense_date, '%Y-%m-01')";
  if (groupBy === "day") expr = "DATE_FORMAT(me.expense_date, '%Y-%m-%d')";
  if (groupBy === "week") expr = "STR_TO_DATE(CONCAT(YEAR(me.expense_date), '-', LPAD(WEEK(me.expense_date, 1), 2, '0'), '-1'), '%X-%V-%w')";
  if (groupBy === "quarter") expr = "CONCAT(YEAR(me.expense_date), '-Q', QUARTER(me.expense_date))";
  if (groupBy === "year") expr = "DATE_FORMAT(me.expense_date, '%Y-01-01')";

  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (options.from) {
    conditions.push("me.expense_date >= ?");
    params.push(options.from);
  }
  if (options.to) {
    conditions.push("me.expense_date <= ?");
    params.push(options.to);
  }
  if (typeof options.category === "string") {
    if (options.category.length) {
      conditions.push("me.category = ?");
      params.push(options.category);
    } else {
      conditions.push("me.category IS NULL");
    }
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${expr} AS period_key,
            SUM(me.amount_expected) AS total_expected,
            COALESCE(SUM(met.amount), 0) AS total_applied,
            COUNT(DISTINCT me.id) AS expense_count
       FROM monthly_expenses me
       LEFT JOIN monthly_expense_transactions met ON met.monthly_expense_id = me.id
      ${whereClause}
      GROUP BY period_key
      ORDER BY period_key DESC`,
    params
  );
  return rows.map((row) => ({
    period: row.period_key != null ? String(row.period_key) : "",
    total_expected: Number(row.total_expected ?? 0),
    total_applied: Number(row.total_applied ?? 0),
    expense_count: Number(row.expense_count ?? 0),
  }));
}

export type DailyBalance = {
  date: string;
  balance: number;
  note: string | null;
};

function mapServiceRow(row: RowDataPacket): ServiceRecord {
  return {
    id: Number(row.id),
    public_id: String(row.public_id),
    name: String(row.name),
    detail: row.detail != null ? String(row.detail) : null,
    category: row.category != null ? String(row.category) : null,
    service_type: (row.service_type as ServiceType) ?? 'BUSINESS',
    ownership: (row.ownership as ServiceOwnership) ?? 'COMPANY',
    obligation_type: (row.obligation_type as ServiceObligationType) ?? 'SERVICE',
    recurrence_type: (row.recurrence_type as ServiceRecurrenceType) ?? 'RECURRING',
    frequency: (row.frequency as ServiceFrequency) ?? 'MONTHLY',
    default_amount: Number(row.default_amount ?? 0),
    amount_indexation: (row.amount_indexation as ServiceAmountIndexation) ?? 'NONE',
    counterpart_id: row.counterpart_id != null ? Number(row.counterpart_id) : null,
    counterpart_account_id: row.counterpart_account_id != null ? Number(row.counterpart_account_id) : null,
    account_reference: row.account_reference != null ? String(row.account_reference) : null,
    emission_day: row.emission_day != null ? Number(row.emission_day) : null,
    emission_mode: (row.emission_mode as ServiceEmissionMode) ?? 'FIXED_DAY',
    emission_start_day: row.emission_start_day != null ? Number(row.emission_start_day) : null,
    emission_end_day: row.emission_end_day != null ? Number(row.emission_end_day) : null,
    emission_exact_date: row.emission_exact_date != null ? toDateOnly(row.emission_exact_date) : null,
    due_day: row.due_day != null ? Number(row.due_day) : null,
    start_date: toDateOnly(row.start_date),
    next_generation_months: Number(row.next_generation_months ?? 12),
    late_fee_mode: (row.late_fee_mode as ServiceLateFeeMode) ?? 'NONE',
    late_fee_value: row.late_fee_value != null ? Number(row.late_fee_value) : null,
    late_fee_grace_days: row.late_fee_grace_days != null ? Number(row.late_fee_grace_days) : null,
    status: (row.status as ServiceStatus) ?? 'ACTIVE',
    notes: row.notes != null ? String(row.notes) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    counterpart_name: row.counterpart_name != null ? String(row.counterpart_name) : null,
    counterpart_account_identifier: row.counterpart_account_identifier != null ? String(row.counterpart_account_identifier) : null,
    counterpart_account_bank_name: row.counterpart_account_bank_name != null ? String(row.counterpart_account_bank_name) : null,
    counterpart_account_type: row.counterpart_account_type != null ? String(row.counterpart_account_type) : null,
  } satisfies ServiceRecord;
}

async function fetchServiceRecordById(connection: mysql.PoolConnection | Pool, id: number): Promise<ServiceRecord> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT * FROM services WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) {
    throw new Error("Servicio no encontrado");
  }
  return mapServiceRow(rows[0]);
}

function parseTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
  } catch {
    // ignore
  }
  return [];
}

function mapMonthlyExpenseRow(row: RowDataPacket): MonthlyExpenseRecord {
  return {
    id: Number(row.id),
    public_id: String(row.public_id),
    name: String(row.name),
    category: row.category != null ? String(row.category) : null,
    amount_expected: Number(row.amount_expected ?? 0),
    expense_date: row.expense_date instanceof Date ? row.expense_date.toISOString().slice(0, 10) : String(row.expense_date),
    notes: row.notes != null ? String(row.notes) : null,
    source: (row.source as MonthlyExpenseSource) ?? 'MANUAL',
    service_id: row.service_id != null ? Number(row.service_id) : null,
    tags: parseTags(row.tags),
    status: (row.status as 'OPEN' | 'CLOSED') ?? 'OPEN',
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    amount_applied: Number(row.amount_applied ?? 0),
    transaction_count: Number(row.transaction_count ?? 0),
  } satisfies MonthlyExpenseRecord;
}

function mapServiceScheduleRow(row: RowDataPacket): ServiceScheduleRecord {
  return {
    id: Number(row.id),
    service_id: Number(row.service_id),
    period_start: toDateOnly(row.period_start),
    period_end: toDateOnly(row.period_end),
    due_date: toDateOnly(row.due_date),
    expected_amount: Number(row.expected_amount ?? 0),
    status: (row.status as ServiceScheduleRecord['status']) ?? 'PENDING',
    transaction_id: row.transaction_id != null ? Number(row.transaction_id) : null,
    paid_amount: row.paid_amount != null ? Number(row.paid_amount) : null,
    paid_date: row.paid_date != null ? toDateOnly(row.paid_date) : null,
    note: row.note != null ? String(row.note) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    late_fee_amount: 0,
    effective_amount: Number(row.expected_amount ?? 0),
    overdue_days: 0,
  } satisfies ServiceScheduleRecord;
}

function applyDerivedScheduleAmounts(
  service: ServiceRecord,
  schedule: ServiceScheduleWithTransaction
): ServiceScheduleWithTransaction {
  const today = dayjs().startOf('day');
  const dueDate = dayjs(schedule.due_date);
  const overdueDays = Math.max(0, today.diff(dueDate, 'day'));

  let lateFee = 0;
  if (
    service.late_fee_mode !== 'NONE' &&
    !['PAID', 'SKIPPED'].includes(schedule.status) &&
    overdueDays > (service.late_fee_grace_days ?? 0)
  ) {
    const baseline = schedule.expected_amount;
    const feeValue = service.late_fee_value ?? 0;
    if (service.late_fee_mode === 'FIXED') {
      lateFee = feeValue;
    } else {
      lateFee = roundCurrency(baseline * (feeValue / 100));
    }
  }

  const effectiveAmount = roundCurrency(schedule.expected_amount + lateFee);

  return {
    ...schedule,
    late_fee_amount: roundCurrency(lateFee),
    effective_amount: effectiveAmount,
    overdue_days: overdueDays,
  } satisfies ServiceScheduleWithTransaction;
}

export async function listDailyBalances(options: { from?: string; to?: string }) {
  const pool = getPool();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (options.from) {
    conditions.push("balance_date >= ?");
    params.push(options.from);
  }

  if (options.to) {
    conditions.push("balance_date <= ?");
    params.push(options.to);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT balance_date, balance, note
     FROM mp_daily_balances
     ${whereClause}
     ORDER BY balance_date ASC`,
    params
  );

  return rows.map((row) => ({
    date: toDateOnly(row.balance_date),
    balance: Number(row.balance ?? 0),
    note: (row.note as string) ?? null,
  })) satisfies DailyBalance[];
}

export async function getPreviousDailyBalance(date: string) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT balance_date, balance, note
     FROM mp_daily_balances
     WHERE balance_date < ?
     ORDER BY balance_date DESC
     LIMIT 1`,
    [date]
  );

  const row = rows[0];
  if (!row) return null;
  return {
    date: toDateOnly(row.balance_date),
    balance: Number(row.balance ?? 0),
    note: (row.note as string) ?? null,
  } satisfies DailyBalance;
}

export async function upsertDailyBalance(entry: { date: string; balance: number; note?: string | null }) {
  const pool = getPool();
  await pool.query<ResultSetHeader>(
    `INSERT INTO mp_daily_balances (balance_date, balance, note)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = VALUES(balance), note = VALUES(note)`,
    [entry.date, entry.balance, entry.note ?? null]
  );
}

function toDateOnly(value: Date | string | null): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return "";
}

export type EmployeeRecord = {
  id: number;
  full_name: string;
  role: string;
  email: string | null;
  rut: string | null;
  bank_name: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  salary_type: "hourly" | "fixed";
  hourly_rate: number;
  fixed_salary: number | null;
  overtime_rate: number | null;
  retention_rate: number;
  status: "ACTIVE" | "INACTIVE";
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const EMPLOYEE_FIELDS = `id, full_name, role, email, rut, bank_name, bank_account_type, bank_account_number, salary_type, hourly_rate, fixed_salary, overtime_rate, retention_rate, status, metadata, created_at, updated_at`;

export async function listEmployees(options: { includeInactive?: boolean } = {}) {
  const pool = getPool();
  const whereClause = options.includeInactive ? "" : "WHERE status = 'ACTIVE'";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EMPLOYEE_FIELDS}
     FROM employees
     ${whereClause}
     ORDER BY full_name ASC`
  );

  return rows.map(mapEmployeeRow);
}

export async function getEmployeeById(id: number) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EMPLOYEE_FIELDS}
     FROM employees
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row ? mapEmployeeRow(row) : null;
}

export async function findEmployeeByEmail(email: string) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EMPLOYEE_FIELDS}
       FROM employees
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1`,
    [email]
  );
  const row = rows[0];
  return row ? mapEmployeeRow(row) : null;
}

export async function createEmployee(data: {
  full_name: string;
  role: string;
  email?: string | null;
  rut?: string | null;
  bank_name?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  salary_type: "hourly" | "fixed";
  hourly_rate?: number;
  fixed_salary?: number | null;
  overtime_rate?: number | null;
  retention_rate: number;
  metadata?: Record<string, unknown> | null;
}) {
  const pool = getPool();
  const normalizedRut = data.rut ? normalizeRut(data.rut) : null;
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO employees
      (full_name, role, email, rut, bank_name, bank_account_type, bank_account_number, salary_type, hourly_rate, fixed_salary, overtime_rate, retention_rate, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      data.full_name,
      data.role,
      data.email ?? null,
      normalizedRut,
      data.bank_name ?? null,
      data.bank_account_type ?? null,
      data.bank_account_number ?? null,
      data.salary_type,
      data.hourly_rate ?? null,
      data.fixed_salary ?? null,
      data.overtime_rate ?? null,
      data.retention_rate,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );

  return getEmployeeById(Number(result.insertId));
}

export async function updateEmployee(
  id: number,
  data: {
    full_name?: string;
    role?: string;
    email?: string | null;
    rut?: string | null;
    bank_name?: string | null;
    bank_account_type?: string | null;
    bank_account_number?: string | null;
    salary_type?: "hourly" | "fixed";
    hourly_rate?: number;
    fixed_salary?: number | null;
    overtime_rate?: number | null;
    retention_rate?: number;
    status?: "ACTIVE" | "INACTIVE";
    metadata?: Record<string, unknown> | null;
  }
) {
  const pool = getPool();
  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  if (data.full_name != null) {
    fields.push("full_name = ?");
    params.push(data.full_name);
  }
  if (data.role != null) {
    fields.push("role = ?");
    params.push(data.role);
  }
  if (data.email !== undefined) {
    fields.push("email = ?");
    params.push(data.email ?? null);
  }
  if (data.rut !== undefined) {
    fields.push("rut = ?");
    params.push(data.rut ? normalizeRut(data.rut) : null);
  }
  if (data.bank_name !== undefined) {
    fields.push("bank_name = ?");
    params.push(data.bank_name ?? null);
  }
  if (data.bank_account_type !== undefined) {
    fields.push("bank_account_type = ?");
    params.push(data.bank_account_type ?? null);
  }
  if (data.bank_account_number !== undefined) {
    fields.push("bank_account_number = ?");
    params.push(data.bank_account_number ?? null);
  }
  if (data.salary_type != null) {
    fields.push("salary_type = ?");
    params.push(data.salary_type);
  }
  if (data.hourly_rate != null) {
    fields.push("hourly_rate = ?");
    params.push(data.hourly_rate);
  }
  if (data.fixed_salary !== undefined) {
    fields.push("fixed_salary = ?");
    params.push(data.fixed_salary ?? null);
  }
  if (data.overtime_rate !== undefined) {
    fields.push("overtime_rate = ?");
    params.push(data.overtime_rate ?? null);
  }
  if (data.retention_rate != null) {
    fields.push("retention_rate = ?");
    params.push(data.retention_rate);
  }
  if (data.status != null) {
    fields.push("status = ?");
    params.push(data.status);
  }
  if (data.metadata !== undefined) {
    fields.push("metadata = ?");
    params.push(data.metadata ? JSON.stringify(data.metadata) : null);
  }

  if (!fields.length) return getEmployeeById(id);

  params.push(id);
  await pool.query<ResultSetHeader>(
    `UPDATE employees
     SET ${fields.join(", ")}
     WHERE id = ?`,
    params
  );

  return getEmployeeById(id);
}

export async function deactivateEmployee(id: number) {
  await updateEmployee(id, { status: "INACTIVE" });
}

function mapEmployeeRow(row: RowDataPacket): EmployeeRecord {
  return {
    id: Number(row.id),
    full_name: String(row.full_name),
    role: String(row.role),
    email: row.email ? String(row.email) : null,
    rut: row.rut ? String(row.rut) : null,
    bank_name: row.bank_name ? String(row.bank_name) : null,
    bank_account_type: row.bank_account_type ? String(row.bank_account_type) : null,
    bank_account_number: row.bank_account_number ? String(row.bank_account_number) : null,
    salary_type: row.salary_type === "fixed" ? "fixed" : "hourly",
    hourly_rate: Number(row.hourly_rate ?? 0),
    fixed_salary: row.fixed_salary != null ? Number(row.fixed_salary) : null,
    overtime_rate: row.overtime_rate != null ? Number(row.overtime_rate) : null,
    retention_rate: Number(row.retention_rate ?? 0),
    status: row.status as EmployeeRecord["status"],
    metadata: row.metadata ? safeParseJson(row.metadata as string) : null,
    created_at: toDateTime(row.created_at),
    updated_at: toDateTime(row.updated_at),
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toDateTime(value: Date | string | null): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value.includes("T") ? value : `${value}Z`;
  }
  return "";
}

export type TimesheetEntry = {
  id: number;
  employee_id: number;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  worked_minutes: number;
  overtime_minutes: number;
  extra_amount: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

// Helper function to convert HH:MM to minutes
function timeToMinutes(time: string): number | null {
  if (!/^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes >= 60) return null;
  return hours * 60 + minutes;
}

export async function upsertTimesheetEntry(entry: {
  employee_id: number;
  work_date: string;
  start_time?: string | null;
  end_time?: string | null;
  overtime_minutes: number;
  extra_amount: number;
  comment?: string | null;
}) {
  const pool = getPool();
  const startTime = entry.start_time ?? null;
  const endTime = entry.end_time ?? null;
  
  // Calcular worked_minutes desde start_time y end_time
  let workedMinutes = 0;
  if (startTime && endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start !== null && end !== null) {
      workedMinutes = end >= start ? end - start : (24 * 60) + (end - start);
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO employee_timesheets
      (employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       start_time = VALUES(start_time),
       end_time = VALUES(end_time),
       worked_minutes = VALUES(worked_minutes),
       overtime_minutes = VALUES(overtime_minutes),
       extra_amount = VALUES(extra_amount),
       comment = VALUES(comment),
       updated_at = CURRENT_TIMESTAMP`,
    [
      entry.employee_id,
      entry.work_date,
      startTime,
      endTime,
      workedMinutes,
      entry.overtime_minutes,
      entry.extra_amount,
      entry.comment ?? null,
    ]
  );

  const insertedId = result.insertId ? Number(result.insertId) : null;
  if (insertedId) {
    return getTimesheetEntryById(insertedId);
  }

  const poolRow = await getTimesheetEntryByEmployeeAndDate(entry.employee_id, entry.work_date);
  return poolRow;
}

export async function updateTimesheetEntry(
  id: number,
  data: {
    start_time?: string | null;
    end_time?: string | null;
    worked_minutes?: number;
    overtime_minutes?: number;
    extra_amount?: number;
    comment?: string | null;
  }
) {
  const pool = getPool();
  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  if (data.start_time !== undefined) {
    fields.push("start_time = ?");
    params.push(data.start_time ?? null);
  }
  if (data.end_time !== undefined) {
    fields.push("end_time = ?");
    params.push(data.end_time ?? null);
  }
  if (data.worked_minutes != null) {
    fields.push("worked_minutes = ?");
    params.push(data.worked_minutes);
  }
  if (data.overtime_minutes != null) {
    fields.push("overtime_minutes = ?");
    params.push(data.overtime_minutes);
  }
  if (data.extra_amount != null) {
    fields.push("extra_amount = ?");
    params.push(data.extra_amount);
  }
  if (data.comment !== undefined) {
    fields.push("comment = ?");
    params.push(data.comment ?? null);
  }

  if (!fields.length) return getTimesheetEntryById(id);

  params.push(id);
  await pool.query<ResultSetHeader>(
    `UPDATE employee_timesheets
     SET ${fields.join(", ")}
     WHERE id = ?`,
    params
  );

  return getTimesheetEntryById(id);
}

export async function deleteTimesheetEntry(id: number) {
  const pool = getPool();
  await pool.query<ResultSetHeader>(`DELETE FROM employee_timesheets WHERE id = ?`, [id]);
}

export async function listTimesheetEntries(options: {
  employee_id?: number;
  from: string;
  to: string;
}) {
  const pool = getPool();
  const conditions = ["work_date >= ?", "work_date <= ?"];
  const params: Array<string | number> = [options.from, options.to];
  if (options.employee_id) {
    conditions.push("employee_id = ?");
    params.push(options.employee_id);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment, created_at, updated_at
     FROM employee_timesheets
     WHERE ${conditions.join(" AND ")}
     ORDER BY work_date ASC`,
    params
  );

  return rows.map(mapTimesheetRow);
}

export async function getTimesheetEntryByEmployeeAndDate(employeeId: number, workDate: string) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment, created_at, updated_at
     FROM employee_timesheets
     WHERE employee_id = ? AND work_date = ?
     LIMIT 1`,
    [employeeId, workDate]
  );
  const row = rows[0];
  return row ? mapTimesheetRow(row) : null;
}

export async function getTimesheetEntryById(id: number) {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment, created_at, updated_at
     FROM employee_timesheets
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row ? mapTimesheetRow(row) : null;
}

function mapTimesheetRow(row: RowDataPacket): TimesheetEntry {
  return {
    id: Number(row.id),
    employee_id: Number(row.employee_id),
    work_date: toDateOnly(row.work_date),
    start_time: row.start_time ? String(row.start_time).slice(0, 5) : null,
    end_time: row.end_time ? String(row.end_time).slice(0, 5) : null,
    worked_minutes: Number(row.worked_minutes ?? 0),
    overtime_minutes: Number(row.overtime_minutes ?? 0),
    extra_amount: Number(row.extra_amount ?? 0),
    comment: row.comment ? String(row.comment) : null,
    created_at: toDateTime(row.created_at),
    updated_at: toDateTime(row.updated_at),
  };
}

async function seedDefaultSettings(pool: Pool) {
  const entries = Object.entries(SETTINGS_KEY_MAP) as [keyof AppSettings, string][];
  const values = entries.map(([field, key]) => [key, DEFAULT_SETTINGS[field]]);
  await pool.query(
    `INSERT INTO settings (config_key, config_value)
     VALUES ?
     ON DUPLICATE KEY UPDATE config_key = config_key` as string,
    [values]
  );
}

async function seedDefaultAdmin(pool: Pool) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM users`
  );
  const total = rows.length ? Number(rows[0].total ?? 0) : 0;
  if (total > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "No se creó un usuario administrador inicial. Define ADMIN_EMAIL y ADMIN_PASSWORD en tu .env para el bootstrap."
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'GOD')`,
    [email.toLowerCase(), passwordHash]
  );

  console.info(
    `Usuario administrador inicial creado (${email.toLowerCase()}). Cambia la contraseña después del primer inicio.`
  );
}

export async function loadSettings(): Promise<AppSettings> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT config_key AS keyName, config_value AS value FROM settings`
  );

  const map = new Map<string, string>();
  rows.forEach((row) => {
    if (row.keyName) map.set(String(row.keyName), row.value ? String(row.value) : "");
  });

  const result: AppSettings = { ...DEFAULT_SETTINGS };
  (Object.keys(SETTINGS_KEY_MAP) as (keyof AppSettings)[]).forEach((field) => {
    const key = SETTINGS_KEY_MAP[field];
    const value = map.get(key);
    if (typeof value === "string" && value.length) {
      result[field] = value;
    }
  });

  return result;
}

export async function saveSettings(update: Partial<AppSettings>) {
  const entries = Object.entries(update) as [keyof AppSettings, string | undefined][];
  const filtered = entries.filter(([, value]) => typeof value === "string");
  if (!filtered.length) return;

  const pool = getPool();
  const values = filtered.map(([field, value]) => [SETTINGS_KEY_MAP[field], value ?? ""]);

  await pool.query(
    `INSERT INTO settings (config_key, config_value)
     VALUES ?
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)` as string,
    [values]
  );
}

export async function upsertWithdrawals(payouts: PayoutRecord[]) {
  if (!payouts.length) {
    return { inserted: 0, updated: 0 };
  }

  const pool = getPool();
  const values = payouts.map((payout) => [
    payout.withdrawId,
    payout.dateCreated,
    payout.status,
    payout.statusDetail,
    payout.amount,
    payout.fee,
    payout.activityUrl,
    payout.payoutDesc,
    payout.bankAccountHolder,
    payout.identificationType,
    payout.identificationNumber,
    payout.bankId,
    payout.bankName,
    payout.bankBranch,
    payout.bankAccountType,
    payout.bankAccountNumber,
    JSON.stringify(payout.raw),
  ]);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO mp_withdrawals (
        withdraw_id,
        date_created,
        status,
        status_detail,
        amount,
        fee,
        activity_url,
        payout_desc,
        bank_account_holder,
        identification_type,
        identification_number,
        bank_id,
        bank_name,
        bank_branch,
        bank_account_type,
        bank_account_number,
        raw_json
      ) VALUES ?
      ON DUPLICATE KEY UPDATE
        date_created = VALUES(date_created),
        status = VALUES(status),
        status_detail = VALUES(status_detail),
        amount = VALUES(amount),
        fee = VALUES(fee),
        activity_url = VALUES(activity_url),
        payout_desc = VALUES(payout_desc),
        bank_account_holder = VALUES(bank_account_holder),
        identification_type = VALUES(identification_type),
        identification_number = VALUES(identification_number),
        bank_id = VALUES(bank_id),
        bank_name = VALUES(bank_name),
        bank_branch = VALUES(bank_branch),
        bank_account_type = VALUES(bank_account_type),
        bank_account_number = VALUES(bank_account_number),
        raw_json = VALUES(raw_json)` as string,
    [values]
  );

  const inserted = result.affectedRows - result.changedRows;
  const updated = result.changedRows;

  return { inserted, updated };
}

function mapCounterpart(row: RowDataPacket): CounterpartRecord {
  return {
    id: Number(row.id),
    rut: row.rut ? String(row.rut) : null,
    name: String(row.name),
    personType: (row.person_type as CounterpartPersonType) ?? "OTHER",
    category: (row.category as CounterpartRecord["category"]) ?? "SUPPLIER",
    employeeId: row.employee_id != null ? Number(row.employee_id) : null,
    email: row.email ? String(row.email) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapCounterpartAccount(row: RowDataPacket): CounterpartAccountRecord {
  let metadata: CounterpartAccountMetadata | null = null;
  if (row.metadata) {
    try {
      const parsed = JSON.parse(String(row.metadata));
      metadata = parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      metadata = null;
    }
  }

  const withdrawBankAccountNumber = row.mw_bank_account_number ? String(row.mw_bank_account_number) : null;
  const withdrawBankName = row.mw_bank_name ? String(row.mw_bank_name) : null;
  const withdrawHolder = row.mw_bank_account_holder ? String(row.mw_bank_account_holder) : null;
  const withdrawAccountType = row.mw_bank_account_type ? String(row.mw_bank_account_type) : null;

  if (withdrawBankAccountNumber || row.account_identifier) {
    const nextMetadata: CounterpartAccountMetadata = {
      bankAccountNumber: withdrawBankAccountNumber ?? metadata?.bankAccountNumber ?? null,
      withdrawId: metadata?.withdrawId ?? (row.account_identifier ? String(row.account_identifier) : null),
    };
    metadata = metadata ? { ...metadata, ...nextMetadata } : nextMetadata;
  }

  return {
    id: Number(row.id),
    counterpart_id: Number(row.counterpart_id),
    account_identifier: String(row.account_identifier),
    bank_name: row.bank_name ? String(row.bank_name) : withdrawBankName,
    account_type: row.account_type ? String(row.account_type) : withdrawAccountType,
    holder: row.holder ? String(row.holder) : withdrawHolder,
    concept: row.concept ? String(row.concept) : null,
    metadata,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listCounterparts(): Promise<CounterpartRecord[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, rut, name, person_type, category, employee_id, email, notes, created_at, updated_at
       FROM mp_counterparts
      ORDER BY name ASC`
  );
  return rows.map(mapCounterpart);
}

export async function getCounterpartById(id: number) {
  const pool = getPool();
  const [[counterpartRow]] = await pool.query<RowDataPacket[]>(
    `SELECT id, rut, name, person_type, category, employee_id, email, notes, created_at, updated_at
       FROM mp_counterparts
      WHERE id = ?
      LIMIT 1` as string,
    [id]
  );
  if (!counterpartRow) return null;
  const [accountRows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id,
            a.counterpart_id,
            a.account_identifier,
            a.bank_name,
            a.account_type,
            a.holder,
            a.concept,
            a.metadata,
            a.created_at,
            a.updated_at,
            MAX(mw.bank_account_number) AS mw_bank_account_number,
            MAX(mw.bank_name) AS mw_bank_name,
            MAX(mw.bank_account_holder) AS mw_bank_account_holder,
            MAX(mw.bank_account_type) AS mw_bank_account_type
       FROM mp_counterpart_accounts a
       LEFT JOIN mp_withdrawals mw ON mw.withdraw_id = a.account_identifier
      WHERE a.counterpart_id = ?
      GROUP BY a.id
      ORDER BY a.created_at ASC` as string,
    [id]
  );
  return {
    counterpart: mapCounterpart(counterpartRow),
    accounts: accountRows.map(mapCounterpartAccount),
  };
}

export async function createCounterpart(payload: {
  rut?: string | null;
  name: string;
  personType: CounterpartPersonType;
  category?: CounterpartRecord["category"];
  employeeId?: number | null;
  employeeEmail?: string | null;
  email?: string | null;
  notes?: string | null;
}) {
  const pool = getPool();
  const rutNormalized = payload.rut ? normalizeRut(payload.rut) : null;
  if (payload.rut && (!rutNormalized || !validateRut(rutNormalized))) {
    throw new Error("RUT inválido");
  }

  let employeeId = payload.employeeId ?? null;
  if (payload.category === "EMPLOYEE") {
    employeeId = await ensureEmployeeForCounterpart(payload.name, payload.email ?? payload.employeeEmail ?? null);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO mp_counterparts (rut, name, person_type, category, employee_id, email, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)` as string,
    [
      rutNormalized,
      payload.name,
      payload.personType,
      payload.category ?? "SUPPLIER",
      employeeId,
      payload.email?.trim() || null,
      payload.notes ?? null,
    ]
  );
  const id = Number(result.insertId);
  if (rutNormalized) {
    await attachAccountsByRut(id, rutNormalized);
  }
  return id;
}

export async function updateCounterpart(
  id: number,
  payload: {
    rut?: string | null;
    name?: string;
    personType?: CounterpartPersonType;
    category?: CounterpartRecord["category"];
    employeeId?: number | null;
    employeeEmail?: string | null;
    email?: string | null;
    notes?: string | null;
  }
) {
  const fields: string[] = [];
  const params: Array<string | number | null> = [];
  let normalizedRut: string | null | undefined;
  if (payload.rut !== undefined) {
    normalizedRut = payload.rut ? normalizeRut(payload.rut) : null;
    if (payload.rut && (!normalizedRut || !validateRut(normalizedRut))) {
      throw new Error("RUT inválido");
    }
    fields.push("rut = ?");
    params.push(normalizedRut);
  }
  if (payload.name !== undefined) {
    fields.push("name = ?");
    params.push(payload.name);
  }
  if (payload.personType !== undefined) {
    fields.push("person_type = ?");
    params.push(payload.personType);
  }
  let employeeId = payload.employeeId ?? null;
  if (payload.category !== undefined) {
    fields.push("category = ?");
    params.push(payload.category);
  }
  if (payload.category === "EMPLOYEE") {
    employeeId = await ensureEmployeeForCounterpart(
      payload.name ?? (await getCounterpartById(id))?.counterpart.name ?? "",
      payload.email ?? payload.employeeEmail ?? null
    );
  }
  if (payload.category !== undefined || payload.employeeId !== undefined || payload.employeeEmail !== undefined) {
    fields.push("employee_id = ?");
    params.push(employeeId);
  }
  if (payload.email !== undefined) {
    fields.push("email = ?");
    params.push(payload.email?.trim() || null);
  }
  if (payload.notes !== undefined) {
    fields.push("notes = ?");
    params.push(payload.notes ?? null);
  }
  if (!fields.length) return;
  params.push(id);
  const pool = getPool();
  await pool.query(`UPDATE mp_counterparts SET ${fields.join(", ")} WHERE id = ? LIMIT 1` as string, params);
  if (normalizedRut) {
    await attachAccountsByRut(id, normalizedRut);
  }
}

async function ensureEmployeeForCounterpart(name: string, email?: string | null) {
  const trimmedEmail = email?.trim();
  if (!trimmedEmail) {
    const employee = await createEmployee({
      full_name: name,
      role: "GENERATED",
      email: null,
      salary_type: "hourly",
      hourly_rate: 0,
      retention_rate: 0,
      metadata: { source: "counterpart" },
    });
    return employee?.id ?? null;
  }
  const existing = await findEmployeeByEmail(trimmedEmail);
  if (existing) {
    return existing.id;
  }
  const employee = await createEmployee({
    full_name: name,
    role: "GENERATED",
    email: trimmedEmail,
    salary_type: "hourly",
    hourly_rate: 0,
    retention_rate: 0,
    metadata: { source: "counterpart" },
  });
  return employee?.id ?? null;
}

async function attachAccountsByRut(counterpartId: number, rut: string) {
  const normalized = normalizeRut(rut);
  if (!normalized) return;
  const numericRut = normalized.replace(/[^0-9K]/gi, "");
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
        t.source_id AS account_identifier,
        MAX(mw.bank_account_holder) AS holder,
        MAX(mw.bank_name) AS bank_name,
        MAX(mw.bank_account_type) AS account_type,
        MAX(mw.bank_account_number) AS bank_account_number
       FROM mp_transactions t
       LEFT JOIN mp_withdrawals mw ON t.source_id = mw.withdraw_id
      WHERE t.direction = 'OUT'
        AND t.source_id IS NOT NULL
        AND mw.identification_number IS NOT NULL
        AND REPLACE(REPLACE(REPLACE(UPPER(mw.identification_number),'.',''),'-',''),' ','') = ?
      GROUP BY t.source_id` as string,
    [numericRut]
  );
  for (const row of rows) {
    const accountIdentifier = row.account_identifier as string | null;
    if (!accountIdentifier) continue;
    await upsertCounterpartAccount(counterpartId, {
      accountIdentifier,
      bankName: row.bank_name ? String(row.bank_name) : null,
      accountType: row.account_type ? String(row.account_type) : null,
      holder: row.holder ? String(row.holder) : null,
      metadata: {
        bankAccountNumber: row.bank_account_number ? String(row.bank_account_number) : null,
        withdrawId: accountIdentifier,
      },
    });
  }
}

export async function upsertCounterpartAccount(
  counterpartId: number,
  payload: {
    accountIdentifier: string;
    bankName?: string | null;
    accountType?: string | null;
    holder?: string | null;
    concept?: string | null;
    metadata?: CounterpartAccountMetadata | null;
  }
): Promise<number> {
  const pool = getPool();
  const identifier = payload.accountIdentifier.trim();
  const metadataJson = payload.metadata != null ? JSON.stringify(payload.metadata) : null;

  const [existingRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, counterpart_id, metadata FROM mp_counterpart_accounts WHERE account_identifier = ? LIMIT 1` as string,
    [identifier]
  );
  if (existingRows.length) {
    const existing = existingRows[0];
    let metadataValue = existing.metadata as string | null;
    if (payload.metadata !== undefined) {
      metadataValue = metadataJson;
    }
    await pool.query(
      `UPDATE mp_counterpart_accounts
          SET counterpart_id = ?, bank_name = ?, account_type = ?, holder = ?, concept = ?, metadata = ?
        WHERE id = ?` as string,
      [
        counterpartId,
        payload.bankName ?? null,
        payload.accountType ?? null,
        payload.holder ?? null,
        payload.concept ?? null,
        metadataValue,
        Number(existing.id),
      ]
    );
    return Number(existing.id);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO mp_counterpart_accounts
        (counterpart_id, account_identifier, bank_name, account_type, holder, concept, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)` as string,
    [
      counterpartId,
      identifier,
      payload.bankName ?? null,
      payload.accountType ?? null,
      payload.holder ?? null,
      payload.concept ?? null,
      metadataJson,
    ]
  );
  return Number(result.insertId);
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: {
    bankName?: string | null;
    accountType?: string | null;
    holder?: string | null;
    concept?: string | null;
    metadata?: CounterpartAccountMetadata | null;
  }
) {
  const fields: string[] = [];
  const params: Array<string | number | null> = [];
  if (payload.bankName !== undefined) {
    fields.push("bank_name = ?");
    params.push(payload.bankName ?? null);
  }
  if (payload.accountType !== undefined) {
    fields.push("account_type = ?");
    params.push(payload.accountType ?? null);
  }
  if (payload.holder !== undefined) {
    fields.push("holder = ?");
    params.push(payload.holder ?? null);
  }
  if (payload.concept !== undefined) {
    fields.push("concept = ?");
    params.push(payload.concept ?? null);
  }
  if (payload.metadata !== undefined) {
    fields.push("metadata = ?");
    params.push(payload.metadata ? JSON.stringify(payload.metadata) : null);
  }
  if (!fields.length) return;
  params.push(accountId);
  const pool = getPool();
  await pool.query(
    `UPDATE mp_counterpart_accounts SET ${fields.join(", ")} WHERE id = ? LIMIT 1` as string,
    params
  );
}

export type CounterpartAccountSuggestion = {
  accountIdentifier: string;
  rut: string | null;
  holder: string | null;
  bankName: string | null;
  accountType: string | null;
  totalAmount: number;
  movements: number;
  assignedCounterpartId: number | null;
};

export async function listAccountSuggestions(query: string, limit: number): Promise<CounterpartAccountSuggestion[]> {
  const pool = getPool();
  const like = `%${query.trim()}%`;
  const normalizedRut = normalizeRut(query);
  const numericRut = normalizedRut ? normalizedRut.replace(/[^0-9K]/gi, "") : null;
  const conditions = [
    "t.source_id LIKE ?",
    "mw.bank_account_number LIKE ?",
    "mw.bank_account_holder LIKE ?",
    "mw.identification_number LIKE ?",
  ];
  const params: Array<string | number> = [like, like, like, like];
  if (numericRut) {
    conditions.push("REPLACE(REPLACE(REPLACE(UPPER(mw.identification_number),'.',''),'-',''),' ','') = ?");
    params.push(numericRut);
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
        t.source_id AS account_identifier,
        MAX(mw.bank_account_number) AS bank_account_number,
        MAX(mw.identification_number) AS rut,
        MAX(mw.bank_account_holder) AS holder,
        MAX(mw.bank_name) AS bank_name,
        MAX(mw.bank_account_type) AS account_type,
        SUM(t.amount) AS total_amount,
        COUNT(*) AS movements,
        MAX(ca.counterpart_id) AS assigned_counterpart_id
      FROM mp_transactions t
      LEFT JOIN mp_withdrawals mw ON t.source_id = mw.withdraw_id
      LEFT JOIN mp_counterpart_accounts ca ON ca.account_identifier = t.source_id
     WHERE t.direction = 'OUT'
       AND (${conditions.join(" OR ")})
     GROUP BY t.source_id
     ORDER BY total_amount DESC, movements DESC
     LIMIT ?` as string,
    [...params, limit]
  );

  return rows.map((row) => ({
    accountIdentifier: String(row.account_identifier),
    rut: row.rut ? String(row.rut) : null,
    holder: row.holder ? String(row.holder) : null,
    bankName: row.bank_name ? String(row.bank_name) : null,
    accountType: row.account_type ? String(row.account_type) : null,
    bankAccountNumber: row.bank_account_number ? String(row.bank_account_number) : null,
    withdrawId: row.account_identifier ? String(row.account_identifier) : null,
    totalAmount: Number(row.total_amount ?? 0),
    movements: Number(row.movements ?? 0),
    assignedCounterpartId: row.assigned_counterpart_id != null ? Number(row.assigned_counterpart_id) : null,
  }));
}

export async function counterpartSummary(
  counterpartId: number,
  params: { from?: string; to?: string }
): Promise<{
  monthly: Array<{ month: string; concept: string; total: number }>;
  byAccount: Array<{
    account_identifier: string;
    concept: string | null;
    bank_name: string | null;
    total: number;
    count: number;
  }>;
}> {
  const pool = getPool();
  const conditions: string[] = ["a.counterpart_id = ?", "t.direction = 'OUT'"];
  const paramsList: Array<string | number> = [counterpartId];
  if (params.from) {
    conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} >= ?`);
    paramsList.push(params.from);
  }
  if (params.to) {
    conditions.push(`${EFFECTIVE_TIMESTAMP_EXPR} <= ?`);
    paramsList.push(params.to);
  }
  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const [monthlyRows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(${EFFECTIVE_TIMESTAMP_EXPR}, '%Y-%m-01') AS month,
            COALESCE(a.concept, 'Sin concepto') AS concept,
            SUM(t.amount) AS total
       FROM mp_transactions t
       JOIN mp_counterpart_accounts a ON t.source_id = a.account_identifier
      ${whereClause}
      GROUP BY month, concept
      ORDER BY month ASC` as string,
    paramsList
  );

  const [accountRows] = await pool.query<RowDataPacket[]>(
    `SELECT a.account_identifier,
            a.concept,
            a.bank_name,
            SUM(t.amount) AS total,
            COUNT(*) AS count
       FROM mp_transactions t
       JOIN mp_counterpart_accounts a ON t.source_id = a.account_identifier
      ${whereClause}
      GROUP BY a.account_identifier, a.concept, a.bank_name
      ORDER BY total DESC` as string,
    paramsList
  );

  return {
    monthly: monthlyRows.map((row) => ({
      month: String(row.month),
      concept: String(row.concept),
      total: Number(row.total ?? 0),
    })),
    byAccount: accountRows.map((row) => ({
      account_identifier: String(row.account_identifier),
      concept: row.concept ? String(row.concept) : null,
      bank_name: row.bank_name ? String(row.bank_name) : null,
      total: Number(row.total ?? 0),
      count: Number(row.count ?? 0),
    })),
  };
}

export async function assignAccountsToCounterpartByRut(counterpartId: number, rut: string) {
  const normalized = normalizeRut(rut);
  if (!normalized || !validateRut(normalized)) {
    throw new Error("El RUT no es válido");
  }
  await attachAccountsByRut(counterpartId, normalized);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.email, u.password_hash, u.role, e.full_name as name
     FROM users u
     LEFT JOIN employees e ON u.email = e.email
     WHERE u.email = ? LIMIT 1`,
    [email.toLowerCase()]
  );

  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: Number(row.id),
    email: String(row.email),
    password_hash: String(row.password_hash),
    role: row.role as UserRole,
    name: row.name ? String(row.name) : null,
  };
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.email, u.password_hash, u.role, e.full_name as name
     FROM users u
     LEFT JOIN employees e ON u.email = e.email
     WHERE u.id = ? LIMIT 1`,
    [id]
  );

  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: Number(row.id),
    email: String(row.email),
    password_hash: String(row.password_hash),
    role: row.role as UserRole,
    name: row.name ? String(row.name) : null,
  };
}

export function isRoleAtLeast(role: UserRole, expected: UserRole[]): boolean {
  if (role === "GOD") return true;
  if (expected.includes(role)) return true;
  return false;
}

// --- Role Mapping Functions ---

export type RoleMapping = {
  employee_role: string;
  app_role: UserRole;
};

export async function listRoleMappings(): Promise<RoleMapping[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT employee_role, app_role FROM role_mappings`
  );
  return rows as RoleMapping[];
}

export async function upsertRoleMapping(employee_role: string, app_role: UserRole): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO role_mappings (employee_role, app_role) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE app_role = VALUES(app_role)`,
    [employee_role, app_role]
  );
}

// --- Inventory Functions ---

export async function listInventoryCategories(): Promise<InventoryCategory[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, created_at FROM inventory_categories ORDER BY name ASC`
  );
  return rows as InventoryCategory[];
}

export async function createInventoryCategory(name: string): Promise<InventoryCategory> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO inventory_categories (name) VALUES (?)`,
    [name]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, created_at FROM inventory_categories WHERE id = ?`,
    [result.insertId]
  );
  return rows[0] as InventoryCategory;
}

export async function listInventoryItems(): Promise<InventoryItem[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      i.id, i.category_id, i.name, i.description, i.current_stock, i.created_at, i.updated_at, c.name as category_name
     FROM inventory_items i
     LEFT JOIN inventory_categories c ON i.category_id = c.id
     ORDER BY i.name ASC`
  );
  return rows as InventoryItem[];
}

export async function createInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryItem> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO inventory_items (category_id, name, description, current_stock) VALUES (?, ?, ?, ?)`,
    [item.category_id, item.name, item.description, item.current_stock]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, category_id, name, description, current_stock, created_at, updated_at FROM inventory_items WHERE id = ?`,
    [result.insertId]
  );
  return rows[0] as InventoryItem;
}

export async function updateInventoryItem(id: number, item: Partial<Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>>): Promise<InventoryItem> {
  const pool = getPool();
  const fields = Object.keys(item).map(k => `\`${k}\` = ?`).join(', ');
  const values = Object.values(item);
  await pool.query(
    `UPDATE inventory_items SET ${fields} WHERE id = ?`,
    [...values, id]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, category_id, name, description, current_stock, created_at, updated_at FROM inventory_items WHERE id = ?`,
    [id]
  );
  return rows[0] as InventoryItem;
}

export async function deleteInventoryItem(id: number): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM inventory_items WHERE id = ?', [id]);
}

export async function createInventoryMovement(movement: Omit<InventoryMovement, 'id' | 'created_at'>): Promise<void> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO inventory_movements (item_id, quantity_change, reason) VALUES (?, ?, ?)`,
      [movement.item_id, movement.quantity_change, movement.reason]
    );
    await connection.query(
      `UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?`,
      [movement.quantity_change, movement.item_id]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
