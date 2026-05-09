-- Address: persist INE codes, carrier capability flags, and geocoding so we
-- never have to re-query Chilexpress for static facts about an address.
ALTER TABLE "addresses"
  ADD COLUMN IF NOT EXISTS "ine_region_code" INTEGER,
  ADD COLUMN IF NOT EXISTS "ine_county_code" INTEGER,
  ADD COLUMN IF NOT EXISTS "supports_cash_on_delivery" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "supports_return" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS "chilexpress_address_id" INTEGER;

-- Shipment: persist every field returned by Chilexpress' create endpoint
-- so we can reprint labels, fetch tracking, and display the full
-- service description without another API round-trip.
ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "service_full_desc" TEXT,
  ADD COLUMN IF NOT EXISTS "certificate_number" INTEGER,
  ADD COLUMN IF NOT EXISTS "reference" TEXT,
  ADD COLUMN IF NOT EXISTS "barcode" TEXT,
  ADD COLUMN IF NOT EXISTS "label_type" INTEGER,
  ADD COLUMN IF NOT EXISTS "tracking_status" TEXT,
  ADD COLUMN IF NOT EXISTS "tracking_updated_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "shipments_barcode_idx" ON "shipments"("barcode");
CREATE INDEX IF NOT EXISTS "addresses_chilexpress_address_id_idx"
  ON "addresses"("chilexpress_address_id");
