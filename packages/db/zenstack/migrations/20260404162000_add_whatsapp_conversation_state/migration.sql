-- Track inbound WhatsApp activity and current customer service window per phone

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_state (
  phone                    TEXT PRIMARY KEY,
  wa_id                    TEXT,
  last_inbound_message_id  TEXT,
  last_inbound_at          TIMESTAMPTZ,
  last_inbound_text        TEXT,
  conversation_id          TEXT,
  window_expires_at        TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_conversation_state_window_expires_at_idx
  ON public.whatsapp_conversation_state(window_expires_at DESC);
