-- Add withdraw transactions table for MercadoPago withdrawals
-- ZenStack migration

CREATE TABLE IF NOT EXISTS public.withdraw_transactions (
  id SERIAL PRIMARY KEY,
  withdraw_id VARCHAR(64) NOT NULL,
  date_created TIMESTAMP NOT NULL,
  status VARCHAR(50),
  status_detail VARCHAR(100),
  amount DECIMAL(17, 2),
  fee DECIMAL(17, 2),
  activity_url VARCHAR(500),
  payout_desc VARCHAR(500),
  bank_account_holder VARCHAR(255),
  identification_type VARCHAR(50),
  identification_number VARCHAR(50),
  bank_id VARCHAR(50),
  bank_name VARCHAR(200),
  bank_branch VARCHAR(200),
  bank_account_type VARCHAR(50),
  bank_account_number VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS withdraw_transactions_withdraw_id_key
  ON public.withdraw_transactions (withdraw_id);

CREATE INDEX IF NOT EXISTS withdraw_transactions_date_created_idx
  ON public.withdraw_transactions (date_created);
