-- appointment_payment_tokens flow columns — additive, idempotent.
--
-- Drift cause: the table was first created by an earlier `zen db push` WITHOUT
-- the flow_* columns. The later migration uses `CREATE TABLE IF NOT EXISTS`,
-- so it no-op'd against the existing table and never added these columns.
-- Symptom in prod: `column AppointmentPaymentToken.flow_step does not exist`
-- on every read (the abono_wa_retry cron was the first query to hit the table).
--
-- Repo rule: additive prod changes via psql IF NOT EXISTS, NOT migrate deploy.
--   bash packages/db/scripts/apply-manual-sql.sh

ALTER TABLE public.appointment_payment_tokens
  ADD COLUMN IF NOT EXISTS flow_step TEXT,
  ADD COLUMN IF NOT EXISTS flow_error TEXT,
  ADD COLUMN IF NOT EXISTS flow_history JSONB NOT NULL DEFAULT '[]'::jsonb;
