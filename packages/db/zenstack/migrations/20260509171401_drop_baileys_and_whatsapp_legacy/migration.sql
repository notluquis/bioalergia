-- Drop legacy Baileys + Whatsapp* tables and enums after migration to
-- WhatsApp Cloud API (Meta official). The wa_* tables are unrelated and
-- remain untouched.
SET search_path TO public, personal;

DROP TABLE IF EXISTS
  "whatsapp_message_receipts",
  "whatsapp_message_reactions",
  "whatsapp_messages",
  "whatsapp_notifications",
  "whatsapp_conversation_state",
  "whatsapp_chats",
  "whatsapp_contacts",
  "whatsapp_blocked_jids",
  "whatsapp_business_chat_labels",
  "whatsapp_business_message_labels",
  "whatsapp_business_labels",
  "whatsapp_business_quick_replies",
  "whatsapp_group_participants",
  "whatsapp_groups",
  "whatsapp_presence_states",
  "baileys_auth_keys",
  "baileys_auth_creds"
CASCADE;

DROP TYPE IF EXISTS
  "WhatsappMessageDirection",
  "WhatsappMessageStatus",
  "WhatsappNotificationStatus",
  "WhatsappOptInStatus"
CASCADE;
