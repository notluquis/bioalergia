-- Baileys WhatsApp auth state persistence (replaces file-based useMultiFileAuthState)
-- Stores credentials as a single JSON row and signal keys as (type, id) → value rows.

CREATE TABLE IF NOT EXISTS "baileys_auth_creds" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "creds" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "baileys_auth_creds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "baileys_auth_keys" (
    "type" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "baileys_auth_keys_pkey" PRIMARY KEY ("type", "id")
);
