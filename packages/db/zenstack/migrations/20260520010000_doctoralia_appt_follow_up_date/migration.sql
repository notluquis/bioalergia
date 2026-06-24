-- Capturar followUpDateWithSameDoctor (próximo control con el mismo doctor).
-- Se parseaba pero no se guardaba. Idempotente.

ALTER TABLE "public"."doctoralia_calendar_appointments"
  ADD COLUMN IF NOT EXISTS "follow_up_date" TIMESTAMPTZ(3);
