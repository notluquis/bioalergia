-- Add patient marketing campaigns and recipient tracking

CREATE TYPE public."PatientCampaignRecipientStatus" AS ENUM (
  'PENDING',
  'SENT',
  'INFO_REQUESTED',
  'IN_NEGOTIATION',
  'ACCEPTED',
  'DISMISSED',
  'NO_RESPONSE'
);

CREATE TABLE IF NOT EXISTS public.patient_campaigns (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  message_template  TEXT,
  image_url         TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patient_campaigns_is_active_idx
  ON public.patient_campaigns(is_active);

CREATE TABLE IF NOT EXISTS public.patient_campaign_recipients (
  id             SERIAL PRIMARY KEY,
  campaign_id    INTEGER NOT NULL REFERENCES public.patient_campaigns(id) ON DELETE CASCADE,
  patient_rut    VARCHAR(20) NOT NULL,
  patient_name   TEXT,
  patient_phone  TEXT,
  status         public."PatientCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
  notes          TEXT,
  sent_at        TIMESTAMPTZ,
  responded_at   TIMESTAMPTZ,
  updated_by     INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS patient_campaign_recipients_campaign_id_patient_rut_key
  ON public.patient_campaign_recipients(campaign_id, patient_rut);

CREATE INDEX IF NOT EXISTS patient_campaign_recipients_patient_rut_idx
  ON public.patient_campaign_recipients(patient_rut);

CREATE INDEX IF NOT EXISTS patient_campaign_recipients_status_idx
  ON public.patient_campaign_recipients(status);

CREATE INDEX IF NOT EXISTS patient_campaign_recipients_campaign_id_idx
  ON public.patient_campaign_recipients(campaign_id);
