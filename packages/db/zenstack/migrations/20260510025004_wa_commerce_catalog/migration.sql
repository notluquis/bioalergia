-- Meta Commerce catalog id per WABA. Enables single-product /
-- multi-product (MPM) interactive messages.
SET search_path TO public, personal;

ALTER TABLE "wa_business_accounts"
  ADD COLUMN IF NOT EXISTS "commerce_catalog_id" TEXT;
