-- Consentimiento informado clínico (Ley 20.584) por procedimiento. Aditivo + idempotente.
CREATE TABLE IF NOT EXISTS "clinical_consents" (
    "id" TEXT NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "procedure_type" TEXT NOT NULL,
    "procedure_name" TEXT NOT NULL,
    "template_version" TEXT NOT NULL,
    "content_snapshot" TEXT NOT NULL,
    "risks_disclosed" TEXT,
    "alternatives_disclosed" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signature_method" TEXT NOT NULL,
    "signer_name" TEXT NOT NULL,
    "signer_rut" TEXT,
    "signer_relationship" TEXT,
    "clinician_id" INTEGER,
    "signed_at" TIMESTAMP(3),
    "refused_reason" TEXT,
    "revoked_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinical_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "clinical_consents_patient_id_status_idx" ON "clinical_consents"("patient_id","status");
CREATE INDEX IF NOT EXISTS "clinical_consents_procedure_type_idx" ON "clinical_consents"("procedure_type");

DO $$ BEGIN
  ALTER TABLE "clinical_consents" ADD CONSTRAINT "clinical_consents_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
