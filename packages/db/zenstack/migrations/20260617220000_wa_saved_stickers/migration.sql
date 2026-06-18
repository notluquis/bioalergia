-- Stickers guardados estilo WhatsApp (WaSavedSticker).
--   Bandeja por WABA (account_id): "Recientes" (auto al enviar) ordenada por
--   last_used_at, y "Guardados" (favorite=true, marcado desde un sticker
--   recibido). El .webp durable vive en R2 (r2_key) — los media ids de Meta
--   expiran ~30d. sha256 deduplica por cuenta (un mismo sticker no se guarda
--   dos veces). FK a wa_business_accounts con ON DELETE CASCADE.
-- Aditivo + idempotente (regla repo: IF NOT EXISTS / DO-block, vía migrate
-- deploy — NUNCA migrate dev/db push).

CREATE TABLE IF NOT EXISTS "wa_saved_stickers" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "r2_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'image/webp',
    "sha256" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "height" INTEGER,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "added_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wa_saved_stickers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wa_saved_stickers_account_id_sha256_key"
    ON "wa_saved_stickers"("account_id", "sha256");
CREATE INDEX IF NOT EXISTS "wa_saved_stickers_account_id_idx"
    ON "wa_saved_stickers"("account_id");
CREATE INDEX IF NOT EXISTS "wa_saved_stickers_favorite_idx"
    ON "wa_saved_stickers"("favorite");
CREATE INDEX IF NOT EXISTS "wa_saved_stickers_last_used_at_idx"
    ON "wa_saved_stickers"("last_used_at");

DO $$ BEGIN
  ALTER TABLE "wa_saved_stickers" ADD CONSTRAINT "wa_saved_stickers_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "wa_business_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
