-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: User self-service password reset token
-- Generado a mano (no via zen migrate, por drift en prod) — aplicar con:
--   pnpm -F @finanzas/db migrate:deploy
-- Idempotente: ADD COLUMN IF NOT EXISTS. 100% aditivo (solo agrega columnas a
-- `users`, no toca datos).
--
--   password_reset_token_hash   SHA-256 del token one-time enviado por email.
--   password_reset_expires_at   expiración (1h). Ambos se limpian al usarse.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_reset_token_hash" TEXT;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_reset_expires_at" TIMESTAMP(3);
