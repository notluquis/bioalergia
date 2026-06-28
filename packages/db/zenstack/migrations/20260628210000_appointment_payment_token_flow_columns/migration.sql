-- appointment_payment_tokens flow columns — additive, idempotent.
--
-- Drift cause: the table was first created by an earlier `zen db push` WITHOUT
-- the flow_* columns. The 20260627190000 migration uses CREATE TABLE IF NOT
-- EXISTS, so it no-op'd against the existing table and never added them.
-- Symptom in prod: `column AppointmentPaymentToken.flow_step does not exist` on
-- every read of the table (abono_wa_retry cron, the MP webhook, the public GET).
-- IF NOT EXISTS makes this safe whether or not the columns already exist.

ALTER TABLE "appointment_payment_tokens" ADD COLUMN IF NOT EXISTS "flow_step" TEXT;
ALTER TABLE "appointment_payment_tokens" ADD COLUMN IF NOT EXISTS "flow_error" TEXT;
ALTER TABLE "appointment_payment_tokens" ADD COLUMN IF NOT EXISTS "flow_history" JSONB NOT NULL DEFAULT '[]';
