-- Chilexpress transport order (OT) auto-created when a chilexpress order is paid.
-- Additive + idempotent (prod has db-push drift; apply with `migrate deploy`).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cx_ot_number" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cx_barcode" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cx_label_base64" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cx_label_type" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_cx_ot_number_key" ON "orders" ("cx_ot_number");
