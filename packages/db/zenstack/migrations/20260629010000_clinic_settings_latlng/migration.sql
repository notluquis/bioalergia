-- ClinicSettings lat/lng for the WhatsApp location header. Additive + idempotent.

ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7);
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7);
