-- Opaque per-order access token for the public order-status page, so the link
-- carries no email (PII) in the URL. Additive + idempotent (prod has db-push
-- drift; apply with `migrate deploy`).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "access_token" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_access_token_key" ON "orders" ("access_token");
