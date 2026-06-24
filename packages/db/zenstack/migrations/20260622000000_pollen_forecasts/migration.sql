-- P3 polen: cache del pronóstico de polen para el widget /polen.
-- Aditivo + idempotente (IF NOT EXISTS / DO-block). Seguro de re-aplicar.

DO $$ BEGIN
  CREATE TYPE "PollenType" AS ENUM ('GRASS', 'TREE', 'WEED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PollenSource" AS ENUM ('GOOGLE', 'CALENDAR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "pollen_forecasts" (
    "id" SERIAL NOT NULL,
    "location_key" TEXT NOT NULL,
    "forecast_date" DATE NOT NULL,
    "pollen_type" "PollenType" NOT NULL,
    "upi_value" INTEGER,
    "category" TEXT,
    "color_hex" TEXT,
    "in_season" BOOLEAN NOT NULL DEFAULT false,
    "source" "PollenSource" NOT NULL DEFAULT 'GOOGLE',
    "health_recommendations" JSONB,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pollen_forecasts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pollen_forecasts_location_key_forecast_date_pollen_type_key"
    ON "pollen_forecasts" ("location_key", "forecast_date", "pollen_type");

CREATE INDEX IF NOT EXISTS "pollen_forecasts_location_key_forecast_date_idx"
    ON "pollen_forecasts" ("location_key", "forecast_date");
