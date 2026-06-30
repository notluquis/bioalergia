-- Patient intake collected via WhatsApp Flow (self-scheduled Doctoralia
-- patients): demographics + clinical + guardian + receipt ref. Decoupled from
-- Person/Patient; staff use the forwarded summary to create the record + annotate
-- Doctoralia by hand. Additive + idempotent (prod has db-push drift; apply with
-- `migrate deploy`).
CREATE TABLE IF NOT EXISTS "intake_submissions" (
  "id" TEXT PRIMARY KEY,
  "appointment_payment_token_id" TEXT,
  "patient_name" TEXT NOT NULL,
  "patient_phone" TEXT NOT NULL,
  "patient_email" TEXT,
  "patient_rut" TEXT,
  "patient_birth_date" DATE,
  "health_insurance" "HealthInsuranceType",
  "isapre_name" TEXT,
  "address" TEXT,
  "reason" TEXT,
  "known_allergies" TEXT,
  "conditions" TEXT,
  "medications" TEXT,
  "is_minor" BOOLEAN,
  "guardian_name" TEXT,
  "guardian_rut" TEXT,
  "guardian_phone" TEXT,
  "guardian_relationship" TEXT,
  "comprobante_r2_key" TEXT,
  "comprobante_mime" TEXT,
  "staff_notified_at" TIMESTAMPTZ(3),
  "source_channel" TEXT NOT NULL DEFAULT 'whatsapp_flow',
  "flow_token" TEXT,
  "raw" JSONB,
  "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "intake_submissions_patient_phone_idx" ON "intake_submissions" ("patient_phone");
CREATE INDEX IF NOT EXISTS "intake_submissions_patient_rut_idx" ON "intake_submissions" ("patient_rut");
CREATE INDEX IF NOT EXISTS "intake_submissions_appointment_payment_token_id_idx" ON "intake_submissions" ("appointment_payment_token_id");

DO $$ BEGIN
  ALTER TABLE "intake_submissions"
    ADD CONSTRAINT "intake_submissions_appointment_payment_token_id_fkey"
    FOREIGN KEY ("appointment_payment_token_id")
    REFERENCES "appointment_payment_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
