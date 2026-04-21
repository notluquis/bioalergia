-- Doctoralia time-zone golden-standard migration.
--
-- Problem (historical):
--   * The calendar-appointment parser uses `parseDoctoraliaDateTime`, which
--     correctly converts Chile wall-clock strings to UTC instants.
--   * The email parser used `new Date(y, m, d, h, min)`, which interprets
--     components in the Node runtime's TZ. On Railway (UTC) this stored
--     Chile wall-clock values verbatim as if they were already UTC.
--   * All Doctoralia moment-in-time columns were `timestamp without time zone`.
--     node-postgres reads that type using the runtime's local TZ, so the same
--     stored value decoded to different instants in different environments.
--
-- This migration closes the loop:
--   1. Backfills the already-wrong email_notifications timestamps by
--      reinterpreting their current naive values as `America/Santiago` and
--      converting to UTC. DST is handled by Postgres itself.
--   2. Promotes every moment-in-time Doctoralia column to TIMESTAMPTZ so
--      reads are TZ-independent going forward.
--
-- Safety:
--   * Runs inside a single transaction.
--   * The backfill is deliberately scoped ONLY to
--     doctoralia_email_notifications.appointment_date and
--     previous_appointment_date — every other column already holds UTC-wall
--     values and the subsequent ALTER just relabels the OID.
--   * patient_birth_date is intentionally left as `timestamp without time
--     zone` since a birthdate is a calendar date, not an instant.
--   * The ALTER COLUMN uses an explicit `USING col AT TIME ZONE 'UTC'` clause
--     so the conversion is deterministic and independent of the database
--     session's `TimeZone` setting.
--
-- Order is load-bearing: backfill email rows first, THEN change types.

BEGIN;

-- 1. Backfill misinterpreted email-notification timestamps.
--    Each stored value is the Chile wall-clock (e.g. 10:15 for a 10:15 a.m.
--    booking). Reinterpret it in 'America/Santiago' (DST-aware) and convert
--    back to UTC, producing the true instant.
UPDATE public.doctoralia_email_notifications
   SET appointment_date = (appointment_date AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC'
 WHERE appointment_date IS NOT NULL;

UPDATE public.doctoralia_email_notifications
   SET previous_appointment_date = (previous_appointment_date AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC'
 WHERE previous_appointment_date IS NOT NULL;

-- 2. Promote Doctoralia moment-in-time columns to TIMESTAMPTZ(3).
--    Every column below currently stores UTC-wall values, so interpreting
--    them AT TIME ZONE 'UTC' is an identity transform for the instant while
--    upgrading the type label.

-- doctoralia_sync_logs
ALTER TABLE public.doctoralia_sync_logs
  ALTER COLUMN started_at TYPE TIMESTAMPTZ(3) USING started_at AT TIME ZONE 'UTC',
  ALTER COLUMN ended_at   TYPE TIMESTAMPTZ(3) USING ended_at   AT TIME ZONE 'UTC';

-- doctoralia_schedules
ALTER TABLE public.doctoralia_schedules
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';

-- doctoralia_calendar_appointments (patient_birth_date intentionally excluded)
ALTER TABLE public.doctoralia_calendar_appointments
  ALTER COLUMN start_at             TYPE TIMESTAMPTZ(3) USING start_at             AT TIME ZONE 'UTC',
  ALTER COLUMN end_at               TYPE TIMESTAMPTZ(3) USING end_at               AT TIME ZONE 'UTC',
  ALTER COLUMN patient_arrival_time TYPE TIMESTAMPTZ(3) USING patient_arrival_time AT TIME ZONE 'UTC',
  ALTER COLUMN created_at           TYPE TIMESTAMPTZ(3) USING created_at           AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at           TYPE TIMESTAMPTZ(3) USING updated_at           AT TIME ZONE 'UTC';

-- doctoralia_work_periods
ALTER TABLE public.doctoralia_work_periods
  ALTER COLUMN start_at   TYPE TIMESTAMPTZ(3) USING start_at   AT TIME ZONE 'UTC',
  ALTER COLUMN end_at     TYPE TIMESTAMPTZ(3) USING end_at     AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';

-- doctoralia_email_notifications
ALTER TABLE public.doctoralia_email_notifications
  ALTER COLUMN appointment_date          TYPE TIMESTAMPTZ(3) USING appointment_date          AT TIME ZONE 'UTC',
  ALTER COLUMN previous_appointment_date TYPE TIMESTAMPTZ(3) USING previous_appointment_date AT TIME ZONE 'UTC',
  ALTER COLUMN created_at                TYPE TIMESTAMPTZ(3) USING created_at                AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at                TYPE TIMESTAMPTZ(3) USING updated_at                AT TIME ZONE 'UTC';

COMMIT;
