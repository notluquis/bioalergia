-- Fix period format checks: Postgres regex doesn't treat \d as digit in CHECK constraints
-- Enforce strict YYYY-MM with month range 01..12

ALTER TABLE "compensation_period_budgets"
  DROP CONSTRAINT IF EXISTS "compensation_period_budgets_period_format_chk";

ALTER TABLE "compensation_period_budgets"
  ADD CONSTRAINT "compensation_period_budgets_period_format_chk"
  CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "financial_transaction_allocations"
  DROP CONSTRAINT IF EXISTS "financial_transaction_allocations_period_format_chk";

ALTER TABLE "financial_transaction_allocations"
  ADD CONSTRAINT "financial_transaction_allocations_period_format_chk"
  CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
