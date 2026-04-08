ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_for_me BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_media BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS media_missing BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS ephemeral_expiration INTEGER,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.whatsapp_message_reactions (
  remote_jid TEXT NOT NULL,
  message_id TEXT NOT NULL,
  actor_jid TEXT NOT NULL,
  emoji TEXT NOT NULL,
  removed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (remote_jid, message_id, actor_jid, emoji)
);

CREATE INDEX IF NOT EXISTS whatsapp_message_reactions_message_idx
  ON public.whatsapp_message_reactions (remote_jid, message_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_message_receipts (
  remote_jid TEXT NOT NULL,
  message_id TEXT NOT NULL,
  recipient_jid TEXT NOT NULL,
  receipt_type TEXT NOT NULL,
  receipt_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  played_at TIMESTAMPTZ,
  delivered_devices JSONB,
  pending_devices JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (remote_jid, message_id, recipient_jid, receipt_type)
);

CREATE INDEX IF NOT EXISTS whatsapp_message_receipts_message_idx
  ON public.whatsapp_message_receipts (remote_jid, message_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_presence_states (
  chat_jid TEXT NOT NULL,
  participant_jid TEXT NOT NULL,
  last_known_presence TEXT NOT NULL,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_jid, participant_jid)
);

CREATE INDEX IF NOT EXISTS whatsapp_presence_states_chat_idx
  ON public.whatsapp_presence_states (chat_jid, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  jid TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  owner TEXT,
  "desc" TEXT,
  creation TIMESTAMPTZ,
  size INTEGER,
  ephemeral_duration INTEGER,
  raw_group_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_groups_updated_at_idx
  ON public.whatsapp_groups (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_group_participants (
  group_jid TEXT NOT NULL,
  participant_jid TEXT NOT NULL,
  admin TEXT,
  is_super_admin BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_jid, participant_jid)
);

CREATE INDEX IF NOT EXISTS whatsapp_group_participants_group_idx
  ON public.whatsapp_group_participants (group_jid, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_blocked_jids (
  jid TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_blocked_jids_updated_at_idx
  ON public.whatsapp_blocked_jids (updated_at DESC);
