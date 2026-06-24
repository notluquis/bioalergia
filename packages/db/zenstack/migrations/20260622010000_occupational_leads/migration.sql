-- P7 stage-A: captación de leads de salud ocupacional. Aditivo + idempotente.
-- Reusa el enum existente "ReactivoLeadStatus".

DO $$ BEGIN
  CREATE TYPE "OccupationalSector" AS ENUM ('MINERIA', 'TRANSPORTE', 'CONSTRUCCION', 'GENERAL', 'OTRO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "occupational_leads" (
    "id" SERIAL NOT NULL,
    "empresa" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "rut" TEXT,
    "sector" "OccupationalSector" NOT NULL DEFAULT 'GENERAL',
    "headcount" INTEGER,
    "message" TEXT,
    "status" "ReactivoLeadStatus" NOT NULL DEFAULT 'NUEVO',
    "source" TEXT NOT NULL DEFAULT 'salud-ocupacional',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occupational_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "occupational_leads_status_idx" ON "occupational_leads" ("status");
CREATE INDEX IF NOT EXISTS "occupational_leads_created_at_idx" ON "occupational_leads" ("created_at");
