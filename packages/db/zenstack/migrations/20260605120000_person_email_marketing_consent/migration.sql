-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Person email marketing consent + unsubscribe token
-- Generado a mano (no via zen migrate, por drift en prod) — aplicar con:
--   pnpm -F @finanzas/db migrate:deploy
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS.
-- 100% aditivo (solo agrega columnas/índice a `people`, no toca datos).
--
-- Campos:
--   email_marketing_opt_in      consentimiento marketing (Ley 21.719). Broadcast
--                               solo a opt_in=true AND unsubscribed_at IS NULL.
--   email_marketing_opt_in_at   timestamp del opt-in (auditoría consentimiento).
--   email_unsubscribed_at       timestamp de baja (one-click List-Unsubscribe).
--   email_unsubscribe_token     token random por persona para el link público.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "people"
  ADD COLUMN IF NOT EXISTS "email_marketing_opt_in" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "people"
  ADD COLUMN IF NOT EXISTS "email_marketing_opt_in_at" TIMESTAMP(3);

ALTER TABLE "people"
  ADD COLUMN IF NOT EXISTS "email_unsubscribed_at" TIMESTAMP(3);

ALTER TABLE "people"
  ADD COLUMN IF NOT EXISTS "email_unsubscribe_token" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "people_email_unsubscribe_token_key"
  ON "people" ("email_unsubscribe_token");
