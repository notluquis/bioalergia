-- Additive + idempotent: adds the DELIVERED order status and a DTE PDF URL column.
-- Safe to run on prod via `migrate deploy` (no data rewrite, no drop).
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "dte_pdf_url" TEXT;
