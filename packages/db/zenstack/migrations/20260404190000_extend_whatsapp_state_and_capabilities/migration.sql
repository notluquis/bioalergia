DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'WhatsappOptInStatus'
  ) THEN
    CREATE TYPE public."WhatsappOptInStatus" AS ENUM (
      'UNKNOWN',
      'OPTED_IN',
      'OPTED_OUT'
    );
  END IF;
END $$;

ALTER TABLE public.whatsapp_notifications
  ADD COLUMN IF NOT EXISTS recipient_wa_id TEXT,
  ADD COLUMN IF NOT EXISTS message_pacing_status TEXT;

ALTER TABLE public.whatsapp_conversation_state
  ADD COLUMN IF NOT EXISTS last_inbound_call_id TEXT,
  ADD COLUMN IF NOT EXISTS last_inbound_call_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_in_status public."WhatsappOptInStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS opted_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_in_source TEXT,
  ADD COLUMN IF NOT EXISTS conversation_origin_type TEXT,
  ADD COLUMN IF NOT EXISTS conversation_expires_at TIMESTAMPTZ;

UPDATE public.whatsapp_conversation_state
SET
  opt_in_status = 'OPTED_IN',
  opted_in_at = COALESCE(opted_in_at, last_inbound_at),
  opt_in_source = COALESCE(opt_in_source, 'legacy_inbound_message')
WHERE
  last_inbound_at IS NOT NULL
  AND opt_in_status = 'UNKNOWN';
