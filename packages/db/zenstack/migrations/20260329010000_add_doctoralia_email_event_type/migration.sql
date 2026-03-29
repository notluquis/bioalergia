-- Add event_type and previous_appointment_date to doctoralia_email_notifications

CREATE TYPE public."DoctoraliaEmailEventType" AS ENUM ('BOOKING', 'MODIFICATION');

ALTER TABLE public.doctoralia_email_notifications
  ADD COLUMN event_type public."DoctoraliaEmailEventType" NOT NULL DEFAULT 'BOOKING',
  ADD COLUMN previous_appointment_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS doctoralia_email_notifications_event_type_idx
  ON public.doctoralia_email_notifications(event_type);
