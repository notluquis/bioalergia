-- Add WhatsApp notification tracking table

CREATE TYPE public."WhatsappNotificationStatus" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED',
  'DELIVERED',
  'READ'
);

CREATE TABLE IF NOT EXISTS public.whatsapp_notifications (
  id                  TEXT PRIMARY KEY,
  patient_name        TEXT NOT NULL,
  patient_phone       TEXT NOT NULL,
  patient_email       TEXT,
  appointment_date    TIMESTAMPTZ,
  appointment_service TEXT,
  appointment_doctor  TEXT,
  email_message_id    TEXT NOT NULL,
  wa_message_id       TEXT,
  status              public."WhatsappNotificationStatus" NOT NULL DEFAULT 'PENDING',
  error_message       TEXT,
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_notifications_email_message_id_key
  ON public.whatsapp_notifications(email_message_id);

CREATE INDEX IF NOT EXISTS whatsapp_notifications_status_idx
  ON public.whatsapp_notifications(status);

CREATE INDEX IF NOT EXISTS whatsapp_notifications_created_at_idx
  ON public.whatsapp_notifications(created_at DESC);
