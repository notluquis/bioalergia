-- Add performance indexes for Transaction filters
-- ZenStack migration

CREATE INDEX IF NOT EXISTS transactions_status_idx
  ON transactions (status);

CREATE INDEX IF NOT EXISTS transactions_transaction_type_idx
  ON transactions (transaction_type);

CREATE INDEX IF NOT EXISTS transactions_external_reference_idx
  ON transactions (external_reference);

CREATE INDEX IF NOT EXISTS transactions_source_id_idx
  ON transactions (source_id);

-- Optional partial-search acceleration (pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS transactions_description_trgm_idx
  ON transactions USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS transactions_external_reference_trgm_idx
  ON transactions USING gin (external_reference gin_trgm_ops);

CREATE INDEX IF NOT EXISTS transactions_source_id_trgm_idx
  ON transactions USING gin (source_id gin_trgm_ops);
