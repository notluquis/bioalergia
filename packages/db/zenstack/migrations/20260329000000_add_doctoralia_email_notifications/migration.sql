-- Add Doctoralia email notification tracking table
-- Stores bookings parsed from Doctoralia notification emails (contacto@doctoralia.cl)

CREATE TABLE IF NOT EXISTS public.doctoralia_email_notifications (
  id                   TEXT PRIMARY KEY,
  email_message_id     TEXT NOT NULL,
  patient_name         TEXT NOT NULL,
  patient_phone        TEXT,
  patient_email        TEXT,
  is_first_appointment BOOLEAN NOT NULL DEFAULT false,
  appointment_date     TIMESTAMPTZ,
  appointment_service  TEXT,
  appointment_doctor   TEXT,
  clinic_address       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS doctoralia_email_notifications_email_message_id_key
  ON public.doctoralia_email_notifications(email_message_id);

CREATE INDEX IF NOT EXISTS doctoralia_email_notifications_created_at_idx
  ON public.doctoralia_email_notifications(created_at DESC);
