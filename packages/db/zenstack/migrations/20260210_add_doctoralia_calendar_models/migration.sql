-- Add Doctoralia Calendar models
-- Manual migration to avoid drift issues with existing tables

-- Create doctoralia_schedules table
CREATE TABLE IF NOT EXISTS public.doctoralia_schedules (
  id SERIAL PRIMARY KEY,
  external_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  facility_id INTEGER,
  speciality_id INTEGER,
  doctor_id INTEGER,
  province_id INTEGER,
  city_id INTEGER,
  has_waiting_room BOOLEAN,
  schedule_type INTEGER NOT NULL DEFAULT 0,
  color_schema_id INTEGER,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  patients_notification_type INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX doctoralia_schedules_external_id_idx ON public.doctoralia_schedules (external_id);

-- Create doctoralia_calendar_appointments table
CREATE TABLE IF NOT EXISTS public.doctoralia_calendar_appointments (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL,
  external_id INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  is_block BOOLEAN NOT NULL DEFAULT false,
  event_type INTEGER NOT NULL,
  scheduled_by INTEGER NOT NULL,
  status INTEGER NOT NULL,
  has_patient BOOLEAN NOT NULL,
  has_waiting_room BOOLEAN,
  insurance_id INTEGER,
  insurance_name TEXT,
  comments TEXT,
  service_id INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  event_services JSONB,
  service_color_schema_id INTEGER NOT NULL,
  service_is_deleted BOOLEAN NOT NULL DEFAULT false,
  attendance INTEGER NOT NULL DEFAULT 0,
  patient_external_id INTEGER NOT NULL,
  patient_reference_id TEXT NOT NULL,
  patient_phone TEXT,
  patient_email TEXT,
  patient_birth_date TIMESTAMP,
  patient_arrival_time TIMESTAMP,
  is_patient_first_time BOOLEAN NOT NULL DEFAULT false,
  is_patient_first_admin_booking BOOLEAN NOT NULL DEFAULT false,
  is_booked_via_secretary_ai BOOLEAN NOT NULL DEFAULT false,
  online_payment_type TEXT,
  online_payment_status TEXT,
  is_paid_online BOOLEAN NOT NULL DEFAULT false,
  communication_channel TEXT,
  fake BOOLEAN NOT NULL DEFAULT false,
  is_event_with_voucher BOOLEAN NOT NULL DEFAULT false,
  duration INTEGER NOT NULL,
  can_notify_patient BOOLEAN NOT NULL,
  no_show_protection BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT doctoralia_calendar_appointments_schedule_id_fkey 
    FOREIGN KEY (schedule_id) REFERENCES public.doctoralia_schedules(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX doctoralia_calendar_appointments_schedule_id_external_id_key 
  ON public.doctoralia_calendar_appointments (schedule_id, external_id);
CREATE INDEX doctoralia_calendar_appointments_schedule_id_idx 
  ON public.doctoralia_calendar_appointments (schedule_id);
CREATE INDEX doctoralia_calendar_appointments_start_at_idx 
  ON public.doctoralia_calendar_appointments (start_at);
CREATE INDEX doctoralia_calendar_appointments_patient_external_id_idx 
  ON public.doctoralia_calendar_appointments (patient_external_id);

-- Create doctoralia_work_periods table
CREATE TABLE IF NOT EXISTS public.doctoralia_work_periods (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT doctoralia_work_periods_schedule_id_fkey 
    FOREIGN KEY (schedule_id) REFERENCES public.doctoralia_schedules(id) ON DELETE CASCADE
);

CREATE INDEX doctoralia_work_periods_schedule_id_idx 
  ON public.doctoralia_work_periods (schedule_id);
CREATE INDEX doctoralia_work_periods_start_at_idx 
  ON public.doctoralia_work_periods (start_at);

-- Create doctoralia_calendar_sync_logs table
CREATE TABLE IF NOT EXISTS public.doctoralia_calendar_sync_logs (
  id SERIAL PRIMARY KEY,
  trigger_source TEXT,
  trigger_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  schedules_synced INTEGER NOT NULL DEFAULT 0,
  appointments_synced INTEGER NOT NULL DEFAULT 0,
  work_periods_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX doctoralia_calendar_sync_logs_started_at_idx 
  ON public.doctoralia_calendar_sync_logs (started_at DESC);
