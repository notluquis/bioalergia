CREATE TABLE IF NOT EXISTS public.appointment_payment_tokens (
  id TEXT PRIMARY KEY,
  email_notification_id TEXT UNIQUE,
  calendar_appointment_id INTEGER UNIQUE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT,
  appointment_date TIMESTAMPTZ(3) NOT NULL,
  doctor_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  is_fonasa BOOLEAN NOT NULL DEFAULT false,
  full_amount_clp INTEGER NOT NULL,
  half_amount_clp INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_amount_clp INTEGER,
  mp_payment_id TEXT,
  paid_at TIMESTAMPTZ(3),
  wa_sent_at TIMESTAMPTZ(3),
  wa_confirm_sent_at TIMESTAMPTZ(3),
  flow_step TEXT,
  flow_error TEXT,
  flow_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT appointment_payment_tokens_email_notification_id_fkey
    FOREIGN KEY (email_notification_id)
    REFERENCES public.doctoralia_email_notifications(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT appointment_payment_tokens_calendar_appointment_id_fkey
    FOREIGN KEY (calendar_appointment_id)
    REFERENCES public.doctoralia_calendar_appointments(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS appointment_payment_tokens_status_idx
  ON public.appointment_payment_tokens(status);

CREATE INDEX IF NOT EXISTS appointment_payment_tokens_patient_phone_idx
  ON public.appointment_payment_tokens(patient_phone);
