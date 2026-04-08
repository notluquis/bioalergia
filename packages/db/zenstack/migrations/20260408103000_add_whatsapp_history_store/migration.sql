DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'WhatsappMessageDirection'
  ) THEN
    CREATE TYPE public."WhatsappMessageDirection" AS ENUM (
      'INBOUND',
      'OUTBOUND'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'WhatsappMessageStatus'
  ) THEN
    CREATE TYPE public."WhatsappMessageStatus" AS ENUM (
      'PENDING',
      'SENT',
      'DELIVERED',
      'READ',
      'PLAYED',
      'FAILED',
      'RECEIVED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                  TEXT PRIMARY KEY,
  remote_jid          TEXT NOT NULL,
  message_id          TEXT NOT NULL,
  participant_jid     TEXT,
  participant_jid_key TEXT NOT NULL DEFAULT '',
  from_me             BOOLEAN NOT NULL DEFAULT FALSE,
  direction           public."WhatsappMessageDirection" NOT NULL,
  message_type        TEXT NOT NULL,
  status              public."WhatsappMessageStatus" NOT NULL DEFAULT 'PENDING',
  phone               TEXT,
  wa_id               TEXT,
  text_preview        TEXT,
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  played_at           TIMESTAMPTZ,
  message_timestamp   TIMESTAMPTZ,
  raw_message_json    JSONB,
  raw_content_json    JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_remote_jid_message_id_participant_jid_key
  ON public.whatsapp_messages (remote_jid, message_id, participant_jid_key);

CREATE INDEX IF NOT EXISTS whatsapp_messages_phone_created_at_idx
  ON public.whatsapp_messages (phone, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_messages_remote_jid_created_at_idx
  ON public.whatsapp_messages (remote_jid, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_messages_status_created_at_idx
  ON public.whatsapp_messages (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
  id                      TEXT PRIMARY KEY,
  jid                     TEXT NOT NULL UNIQUE,
  name                    TEXT,
  conversation_timestamp  TIMESTAMPTZ,
  unread_count            INTEGER,
  archived                BOOLEAN DEFAULT FALSE,
  pinned                  BOOLEAN DEFAULT FALSE,
  mute_end_time           TIMESTAMPTZ,
  not_spam                BOOLEAN,
  last_message_id         TEXT,
  raw_chat_json           JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_chats_conversation_timestamp_idx
  ON public.whatsapp_chats (conversation_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id                TEXT PRIMARY KEY,
  jid               TEXT NOT NULL UNIQUE,
  phone             TEXT,
  name              TEXT,
  notify            TEXT,
  verified_name     TEXT,
  img_url           TEXT,
  raw_contact_json  JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_contacts_phone_idx
  ON public.whatsapp_contacts (phone);
