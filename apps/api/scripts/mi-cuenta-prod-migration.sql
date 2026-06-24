-- Idempotent prod migration for /mi-cuenta on bioalergia.cl
-- Apply with: psql "$DATABASE_URL" -f apps/api/scripts/mi-cuenta-prod-migration.sql
--
-- 1. magic_link_tokens table for passwordless shop login
-- 2. addresses.user_id column for shop-customer-owned addresses
-- 3. ShopCustomer role (idempotent seed)

BEGIN;

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP(3) NOT NULL,
  consumed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS magic_link_tokens_expires_at_idx
  ON magic_link_tokens (expires_at);
CREATE INDEX IF NOT EXISTS magic_link_tokens_user_id_consumed_at_idx
  ON magic_link_tokens (user_id, consumed_at);

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS user_id INTEGER
  REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS addresses_user_id_idx
  ON addresses (user_id);

-- ShopCustomer role for public-shop customers (registro vía bioalergia.cl).
-- This role is INTENTIONALLY low-privilege; their only capability is to
-- read/update their OWN Person / Address / Order rows. Permissions are
-- enforced at the ZenStack policy layer (auth().id == userId).
INSERT INTO roles (name, description, is_system, created_at, updated_at)
VALUES ('ShopCustomer', 'Cliente público de la tienda bioalergia.cl', TRUE, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

COMMIT;
