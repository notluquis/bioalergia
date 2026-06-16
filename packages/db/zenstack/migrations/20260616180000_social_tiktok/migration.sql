-- TikTok Content Posting: nuevo provider + columnas de tokens TikTok en
-- social_accounts. Idempotente (safe re-run / drift baseline en prod).

-- Nuevo valor de enum (debe ir en su propia sentencia; PG no permite usar el
-- valor recién agregado en la misma transacción).
ALTER TYPE "SocialAccountProvider" ADD VALUE IF NOT EXISTS 'TIKTOK';

-- Columnas para el flujo OAuth (PKCE) + refresh de TikTok.
ALTER TABLE "social_accounts"
  ADD COLUMN IF NOT EXISTS "refresh_token" TEXT,
  ADD COLUMN IF NOT EXISTS "refresh_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "external_user_id" TEXT;
