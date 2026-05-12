CREATE TABLE IF NOT EXISTS public.whatsapp_business_quick_replies (
  timestamp   TEXT PRIMARY KEY,
  shortcut    TEXT NOT NULL,
  message     TEXT NOT NULL,
  keywords    JSONB,
  count       INTEGER DEFAULT 0,
  deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_business_quick_replies_deleted_updated_at_idx
  ON public.whatsapp_business_quick_replies (deleted, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_business_labels (
  id             TEXT PRIMARY KEY,
  name           TEXT,
  color          INTEGER,
  deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  predefined_id  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_business_labels_deleted_updated_at_idx
  ON public.whatsapp_business_labels (deleted, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_business_chat_labels (
  label_id    TEXT NOT NULL,
  chat_jid    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (label_id, chat_jid)
);

CREATE INDEX IF NOT EXISTS whatsapp_business_chat_labels_chat_jid_updated_at_idx
  ON public.whatsapp_business_chat_labels (chat_jid, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_business_message_labels (
  label_id    TEXT NOT NULL,
  chat_jid    TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (label_id, chat_jid, message_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_business_message_labels_chat_jid_message_id_updated_at_idx
  ON public.whatsapp_business_message_labels (chat_jid, message_id, updated_at DESC);
