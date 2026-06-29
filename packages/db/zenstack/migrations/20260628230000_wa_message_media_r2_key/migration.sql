-- WaMessage.media_r2_key — durable R2 copy of inbound media.
-- Additive + idempotent (repo rule). Applied via migrate deploy.

ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "media_r2_key" TEXT;
