CREATE TABLE IF NOT EXISTS inventory_allergy_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  parent_id INT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NULL,
  level ENUM('type','category','subtype') NOT NULL DEFAULT 'type',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES inventory_allergy_types(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'inventory_items'
    AND column_name = 'allergy_type_id'
);
SET @add_column_sql := IF(@col_exists = 0,
  'ALTER TABLE inventory_items ADD COLUMN allergy_type_id INT NULL AFTER category_id',
  'SELECT 1'
);
PREPARE add_column_stmt FROM @add_column_sql;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE table_schema = DATABASE()
    AND table_name = 'inventory_items'
    AND constraint_name = 'fk_inventory_item_allergy_type'
);
SET @add_fk_sql := IF(@fk_exists = 0,
  'ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_item_allergy_type FOREIGN KEY (allergy_type_id) REFERENCES inventory_allergy_types(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE add_fk_stmt FROM @add_fk_sql;
EXECUTE add_fk_stmt;
DEALLOCATE PREPARE add_fk_stmt;

CREATE TABLE IF NOT EXISTS inventory_providers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rut VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL UNIQUE,
  contact_info TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_accounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  account_identifier VARCHAR(191) NOT NULL,
  UNIQUE KEY uniq_provider_account_identifier (account_identifier),
  FOREIGN KEY (provider_id) REFERENCES inventory_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_item_providers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  provider_id INT NOT NULL,
  current_price DECIMAL(12,2) NULL,
  last_stock_check DATETIME NULL,
  last_price_check DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES inventory_providers(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_item_provider (item_id, provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @transaction_column_type := (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'mp_transactions'
    AND column_name = 'id'
);
SET @transaction_column_type := IF(@transaction_column_type IS NULL OR @transaction_column_type = '', 'INT', @transaction_column_type);
SET @inventory_checks_sql := CONCAT(
  'CREATE TABLE IF NOT EXISTS inventory_provider_checks (',
  '  id INT PRIMARY KEY AUTO_INCREMENT,',
  '  item_provider_id INT NOT NULL,',
  '  check_type ENUM(''stock'',''price'',''request'') NOT NULL,',
  '  quantity INT NULL,',
  '  price DECIMAL(12,2) NULL,',
  '  notes TEXT NULL,',
  '  transaction_id ', @transaction_column_type, ' NULL,',
  '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
  '  FOREIGN KEY (item_provider_id) REFERENCES inventory_item_providers(id) ON DELETE CASCADE,',
  '  FOREIGN KEY (transaction_id) REFERENCES mp_transactions(id) ON DELETE SET NULL',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE create_inventory_checks_stmt FROM @inventory_checks_sql;
EXECUTE create_inventory_checks_stmt;
DEALLOCATE PREPARE create_inventory_checks_stmt;
