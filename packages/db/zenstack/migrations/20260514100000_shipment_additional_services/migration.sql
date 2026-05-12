-- Persist Chilexpress add-on services (e.g. 417 = Cobertura Extendida)
-- per shipment so revenue reports can attribute the surcharge and a
-- future reprint/reissue can mirror the original OT config.
ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "additional_service_codes" INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "additional_services_cost" DECIMAL(12, 2) NOT NULL DEFAULT 0;
