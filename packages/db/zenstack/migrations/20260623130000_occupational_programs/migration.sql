-- Salud ocupacional P7 stage-B (incremento seguro): programa con gate RIOHS +
-- lotes de resultado AGREGADO. Aditivo + idempotente. Sin PHI individual.

DO $$ BEGIN
  CREATE TYPE "OccupationalProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OccupationalTestingScope" AS ENUM ('DRUGS', 'ALCOHOL', 'BOTH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "occupational_programs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "sector" "OccupationalSector" NOT NULL DEFAULT 'GENERAL',
    "testing_scope" "OccupationalTestingScope" NOT NULL DEFAULT 'BOTH',
    "status" "OccupationalProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "riohs_attested" BOOLEAN NOT NULL DEFAULT false,
    "riohs_clause_ref" TEXT,
    "riohs_attested_at" TIMESTAMP(3),
    "riohs_attested_by" INTEGER,
    "worker_consent_basis" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occupational_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "occupational_test_batches" (
    "id" SERIAL NOT NULL,
    "program_id" INTEGER NOT NULL,
    "batch_date" DATE NOT NULL,
    "total_tested" INTEGER NOT NULL DEFAULT 0,
    "passed_count" INTEGER NOT NULL DEFAULT 0,
    "presumptive_positive_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occupational_test_batches_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "occupational_programs"
    ADD CONSTRAINT "occupational_programs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "occupational_test_batches"
    ADD CONSTRAINT "occupational_test_batches_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "occupational_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "occupational_programs_company_id_idx" ON "occupational_programs" ("company_id");
CREATE INDEX IF NOT EXISTS "occupational_programs_status_idx" ON "occupational_programs" ("status");
CREATE INDEX IF NOT EXISTS "occupational_test_batches_program_id_batch_date_idx" ON "occupational_test_batches" ("program_id", "batch_date");
