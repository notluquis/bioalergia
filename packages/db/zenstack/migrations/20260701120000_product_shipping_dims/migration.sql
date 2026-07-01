-- W3-A: real per-product shipping dimensions (nullable — existing products have none).
-- Additive + idempotent so it is safe to re-run and cannot clobber existing data.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "width_cm" INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "height_cm" INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "length_cm" INTEGER;
