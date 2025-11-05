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

CREATE TABLE IF NOT EXISTS employees (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(191) NOT NULL,
  role VARCHAR(120) NOT NULL,
  email VARCHAR(191) NULL,
  rut VARCHAR(20) NULL,
  bank_name VARCHAR(120) NULL,
  bank_account_type VARCHAR(32) NULL,
  bank_account_number VARCHAR(64) NULL,
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

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(191) NOT NULL,
  role ENUM('GOD','ADMIN','ANALYST','VIEWER') NOT NULL DEFAULT 'VIEWER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  config_key VARCHAR(128) NOT NULL,
  config_value TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS mp_daily_balances (
  balance_date DATE NOT NULL,
  balance DECIMAL(15, 2) NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (balance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS common_supplies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  brand VARCHAR(255),
  model VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS role_mappings (
  employee_role VARCHAR(120) NOT NULL,
  app_role ENUM('GOD','ADMIN','ANALYST','VIEWER') NOT NULL,
  PRIMARY KEY (employee_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  current_stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES inventory_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT,
  quantity_change INT NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
