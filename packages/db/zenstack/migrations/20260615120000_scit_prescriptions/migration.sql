-- ScitPrescription: prescripción de inmunoterapia calculada (Calculadora SCIT),
-- registro inmutable de trazabilidad por paciente (inputs + viales + quién/cuándo).
-- Aditivo + idempotente (regla repo: IF NOT EXISTS, aplicar vía psql / migrate deploy).

-- CreateTable scit_prescriptions
CREATE TABLE IF NOT EXISTS "scit_prescriptions" (
    "id" TEXT NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_rut" TEXT,
    "provider" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "vials" JSONB NOT NULL,
    "alerts" JSONB,
    "rules_applied" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scit_prescriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "scit_prescriptions_patient_id_created_at_idx"
    ON "scit_prescriptions"("patient_id", "created_at");

-- FK a patients (idempotente)
DO $$ BEGIN
  ALTER TABLE "scit_prescriptions"
    ADD CONSTRAINT "scit_prescriptions_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
