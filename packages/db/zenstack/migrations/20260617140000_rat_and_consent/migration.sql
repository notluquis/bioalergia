-- Ley 21.719: Registro de Actividades de Tratamiento (RAT) + Registro de
-- consentimiento. Aditivo + idempotente.

-- RAT
CREATE TABLE IF NOT EXISTS "processing_activities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "legal_basis" TEXT NOT NULL,
    "data_categories" TEXT NOT NULL,
    "data_subjects" TEXT NOT NULL,
    "recipients" TEXT,
    "retention_period" TEXT,
    "security_measures" TEXT,
    "international_transfer" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "processing_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "processing_activities_is_active_name_idx" ON "processing_activities"("is_active","name");

-- Consentimiento
CREATE TABLE IF NOT EXISTS "consent_records" (
    "id" TEXT NOT NULL,
    "person_id" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GRANTED',
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'PRESENCIAL',
    "policy_version" TEXT NOT NULL,
    "evidence_text" TEXT,
    "source" TEXT,
    "recorded_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "consent_records_person_id_purpose_idx" ON "consent_records"("person_id","purpose");
CREATE INDEX IF NOT EXISTS "consent_records_status_idx" ON "consent_records"("status");

DO $$ BEGIN
  ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
