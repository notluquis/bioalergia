-- W3-C: lazy on-view Chilexpress tracking refresh throttle timestamp.
-- Additive + idempotent so it is safe to re-run and cannot clobber existing data.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_checked_at" TIMESTAMP(3);
