-- Simplify Doctoralia schema
-- 1. Drop dead REST-API tables (Booking, Slot, Service, InsuranceProvider,
--    Facility, Doctor, Address, CalendarBreak).
-- 2. Merge DoctoraliaSyncLog + DoctoraliaCalendarSyncLog into a single
--    polymorphic table with sync_type + counts JSON.
-- 3. Add DoctoraliaEmailNotification.calendar_appointment_id FK to
--    DoctoraliaCalendarAppointment for direct email-to-appointment matching.

BEGIN;

-- Drop dead REST-API tables (defensive: IF EXISTS)
DROP TABLE IF EXISTS public.doctoralia_bookings CASCADE;
DROP TABLE IF EXISTS public.doctoralia_slots CASCADE;
DROP TABLE IF EXISTS public.doctoralia_services CASCADE;
DROP TABLE IF EXISTS public.doctoralia_insurance_providers CASCADE;
DROP TABLE IF EXISTS public.doctoralia_calendar_breaks CASCADE;
DROP TABLE IF EXISTS public.doctoralia_doctors CASCADE;
DROP TABLE IF EXISTS public.doctoralia_addresses CASCADE;
DROP TABLE IF EXISTS public.doctoralia_facilities CASCADE;

-- Merge calendar sync logs into the unified doctoralia_sync_logs table.
ALTER TABLE public.doctoralia_sync_logs
  ADD COLUMN IF NOT EXISTS sync_type TEXT NOT NULL DEFAULT 'CALENDAR',
  ADD COLUMN IF NOT EXISTS counts JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill counts from legacy columns for existing CALENDAR rows.
UPDATE public.doctoralia_sync_logs
SET counts = jsonb_build_object(
  'facilitiesSynced', COALESCE(facilities_synced, 0),
  'doctorsSynced',    COALESCE(doctors_synced, 0),
  'slotsSynced',      COALESCE(slots_synced, 0),
  'bookingsSynced',   COALESCE(bookings_synced, 0)
)
WHERE counts = '{}'::jsonb;

-- Drop legacy counter columns.
ALTER TABLE public.doctoralia_sync_logs
  DROP COLUMN IF EXISTS facilities_synced,
  DROP COLUMN IF EXISTS doctors_synced,
  DROP COLUMN IF EXISTS slots_synced,
  DROP COLUMN IF EXISTS bookings_synced;

-- Migrate rows from the separate calendar sync log table (if it exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'doctoralia_calendar_sync_logs'
  ) THEN
    INSERT INTO public.doctoralia_sync_logs
      (sync_type, trigger_source, trigger_user_id, status, started_at, ended_at, counts, error_message)
    SELECT
      'CALENDAR',
      trigger_source,
      trigger_user_id,
      status,
      started_at,
      ended_at,
      jsonb_build_object(
        'schedulesSynced',    COALESCE(schedules_synced, 0),
        'appointmentsSynced', COALESCE(appointments_synced, 0),
        'workPeriodsSynced',  COALESCE(work_periods_synced, 0)
      ),
      error_message
    FROM public.doctoralia_calendar_sync_logs;

    DROP TABLE public.doctoralia_calendar_sync_logs;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS doctoralia_sync_logs_sync_type_idx
  ON public.doctoralia_sync_logs (sync_type);

-- Add FK from email notifications to calendar appointments.
ALTER TABLE public.doctoralia_email_notifications
  ADD COLUMN IF NOT EXISTS calendar_appointment_id INTEGER;

ALTER TABLE public.doctoralia_email_notifications
  DROP CONSTRAINT IF EXISTS doctoralia_email_notifications_calendar_appointment_id_fkey;

ALTER TABLE public.doctoralia_email_notifications
  ADD CONSTRAINT doctoralia_email_notifications_calendar_appointment_id_fkey
  FOREIGN KEY (calendar_appointment_id)
  REFERENCES public.doctoralia_calendar_appointments(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS doctoralia_email_notifications_calendar_appointment_id_idx
  ON public.doctoralia_email_notifications (calendar_appointment_id);

COMMIT;
