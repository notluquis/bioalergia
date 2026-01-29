-- Split dosage string into separate value and unit columns
-- Dropping the old dosage column since data will be re-synced from Google Calendar
ALTER TABLE "events" DROP COLUMN IF EXISTS "dosage";
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "dosage_value" DOUBLE PRECISION;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "dosage_unit" TEXT;
