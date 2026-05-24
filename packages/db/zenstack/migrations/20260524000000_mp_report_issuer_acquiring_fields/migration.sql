-- MercadoPago report: new issuer/acquiring + short-date columns (additive, idempotent)

-- ReleaseTransaction (liberación)
ALTER TABLE "public"."release_transactions" ADD COLUMN IF NOT EXISTS "country_issuer" TEXT;
ALTER TABLE "public"."release_transactions" ADD COLUMN IF NOT EXISTS "merchant_category_code" TEXT;
ALTER TABLE "public"."release_transactions" ADD COLUMN IF NOT EXISTS "card_entry_mode" TEXT;
ALTER TABLE "public"."release_transactions" ADD COLUMN IF NOT EXISTS "authorization_code" TEXT;
ALTER TABLE "public"."release_transactions" ADD COLUMN IF NOT EXISTS "application_id" TEXT;
ALTER TABLE "public"."release_transactions" ADD COLUMN IF NOT EXISTS "segment_detail" TEXT;
ALTER TABLE "public"."release_transactions" ADD COLUMN IF NOT EXISTS "date_short" TEXT;
ALTER TABLE "public"."release_transactions" ADD COLUMN IF NOT EXISTS "transaction_approval_date_short" TEXT;

-- SettlementTransaction (conciliación)
ALTER TABLE "public"."settlement_transactions" ADD COLUMN IF NOT EXISTS "merchant_category_code" TEXT;
ALTER TABLE "public"."settlement_transactions" ADD COLUMN IF NOT EXISTS "application_id" TEXT;
ALTER TABLE "public"."settlement_transactions" ADD COLUMN IF NOT EXISTS "segment_detail" TEXT;
ALTER TABLE "public"."settlement_transactions" ADD COLUMN IF NOT EXISTS "authorization_code" TEXT;
ALTER TABLE "public"."settlement_transactions" ADD COLUMN IF NOT EXISTS "card_entry_mode" TEXT;
ALTER TABLE "public"."settlement_transactions" ADD COLUMN IF NOT EXISTS "authenticated_payer" TEXT;
ALTER TABLE "public"."settlement_transactions" ADD COLUMN IF NOT EXISTS "transaction_date_short" TEXT;
ALTER TABLE "public"."settlement_transactions" ADD COLUMN IF NOT EXISTS "settlement_date_short" TEXT;
ALTER TABLE "public"."settlement_transactions" ADD COLUMN IF NOT EXISTS "money_release_date_short" TEXT;
