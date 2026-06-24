-- Salud ocupacional P7 stage-C: resultado individual + cadena de custodia +
-- confirmatorio + consentimientos + divulgación. Aditivo + idempotente.

-- ── Enums ────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "OccTestingReason" AS ENUM ('PRE_EMPLEO','PERIODICO','ALEATORIO','POST_ACCIDENTE','SOSPECHA_RAZONABLE','RETORNO','CONTROL_POLICIAL','OTRO'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccRequestSource" AS ENUM ('ORDEN_MEDICA','SOLICITUD_EMPLEADOR','ORDEN_JUDICIAL','SUPERVISOR_FAENA'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccRegulatoryBasis" AS ENUM ('DS_132_ART_40','RIOHS','LEY_18290','DS_44_PROGRAMA','POLITICA_EMPRESA'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccMandateType" AS ENUM ('MANDATED_BY_LAW','PERMITTED_VIA_RIOHS','COMPANY_POLICY'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccOrderStatus" AS ENUM ('DRAFT','CONSENT_PENDING','COLLECTED','IN_TRANSIT','RECEIVED','SCREENING','PRESUMPTIVE_POSITIVE','CONFIRMATION_PENDING','MEDICAL_REVIEW','RESULTED','INVALID','CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccFinalResult" AS ENUM ('PENDING','NEGATIVE','POSITIVE','NEGATIVE_MEDICALLY_EXPLAINED','INVALID'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccSampleKind" AS ENUM ('MUESTRA','CONTRAMUESTRA'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccMatrix" AS ENUM ('ORINA','SANGRE','SALIVA','ALIENTO'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccCustodyAction" AS ENUM ('COLLECT','SPLIT','SEAL','DONOR_VERIFY','HANDOFF','TRANSPORT','RECEIVE','SEAL_CHECK','ALIQUOT','STORE','DESTROY'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccScreeningOutcome" AS ENUM ('NEGATIVE','PRESUMPTIVE_POSITIVE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccConfirmMethod" AS ENUM ('GC_MS','LC_MS_MS'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccConfirmOutcome" AS ENUM ('NEGATIVE','POSITIVE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccReviewDecision" AS ENUM ('CONFIRMED_POSITIVE','EXPLAINED_BY_RX'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccConsentPurpose" AS ENUM ('TEST','EMPLOYER_DISCLOSURE','SUBSTANCE_LEVEL_DISCLOSURE','IDENTITY_LINK'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccDisclosureAudience" AS ENUM ('WORKER','EMPLOYER','JUDICIAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OccDisclosurePayload" AS ENUM ('AGGREGATE','FITNESS_OUTCOME','SUBSTANCE_DETAIL','FULL_RESULT'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Tablas ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "occ_test_subjects" (
    "id" SERIAL NOT NULL,
    "subject_code" TEXT NOT NULL,
    "person_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occ_test_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "occ_test_subjects_subject_code_key" ON "occ_test_subjects" ("subject_code");
CREATE INDEX IF NOT EXISTS "occ_test_subjects_person_id_idx" ON "occ_test_subjects" ("person_id");

CREATE TABLE IF NOT EXISTS "occ_test_orders" (
    "id" SERIAL NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "program_id" INTEGER,
    "company_id" INTEGER,
    "testing_reason" "OccTestingReason" NOT NULL,
    "request_source" "OccRequestSource" NOT NULL,
    "regulatory_basis" "OccRegulatoryBasis" NOT NULL,
    "mandate_type" "OccMandateType" NOT NULL,
    "riohs_clause_ref" TEXT,
    "status" "OccOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "final_result" "OccFinalResult" NOT NULL DEFAULT 'PENDING',
    "refusal_flag" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_entry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occ_test_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "occ_test_orders_subject_id_idx" ON "occ_test_orders" ("subject_id");
CREATE INDEX IF NOT EXISTS "occ_test_orders_program_id_idx" ON "occ_test_orders" ("program_id");
CREATE INDEX IF NOT EXISTS "occ_test_orders_status_idx" ON "occ_test_orders" ("status");

CREATE TABLE IF NOT EXISTS "occ_samples" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "kind" "OccSampleKind" NOT NULL,
    "container_code" TEXT NOT NULL,
    "matrix" "OccMatrix" NOT NULL DEFAULT 'ORINA',
    "seal_id" TEXT,
    "seal_intact" BOOLEAN NOT NULL DEFAULT true,
    "primary_aliquot_of" INTEGER,
    "validity" JSONB,
    "stored_temp_c" DOUBLE PRECISION,
    "destroyed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occ_samples_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "occ_samples_container_code_key" ON "occ_samples" ("container_code");
CREATE INDEX IF NOT EXISTS "occ_samples_order_id_idx" ON "occ_samples" ("order_id");

CREATE TABLE IF NOT EXISTS "occ_custody_events" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "sample_id" INTEGER,
    "action" "OccCustodyAction" NOT NULL,
    "actor_id" INTEGER,
    "actor_role" TEXT,
    "signature_ref" TEXT,
    "seal_intact" BOOLEAN,
    "location" TEXT,
    "notes" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occ_custody_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "occ_custody_events_order_id_idx" ON "occ_custody_events" ("order_id");
CREATE INDEX IF NOT EXISTS "occ_custody_events_sample_id_idx" ON "occ_custody_events" ("sample_id");

CREATE TABLE IF NOT EXISTS "occ_screening_results" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'inmunoensayo',
    "panel" JSONB NOT NULL,
    "outcome" "OccScreeningOutcome" NOT NULL,
    "lab_id" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occ_screening_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "occ_screening_results_order_id_key" ON "occ_screening_results" ("order_id");

CREATE TABLE IF NOT EXISTS "occ_confirmatory_results" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "method" "OccConfirmMethod" NOT NULL,
    "sample_id" INTEGER,
    "analytes" JSONB NOT NULL,
    "outcome" "OccConfirmOutcome" NOT NULL,
    "confirming_lab_id" TEXT,
    "iso_accredited" BOOLEAN NOT NULL DEFAULT false,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occ_confirmatory_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "occ_confirmatory_results_order_id_key" ON "occ_confirmatory_results" ("order_id");

CREATE TABLE IF NOT EXISTS "occ_medical_reviews" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "reviewer_id" INTEGER,
    "declared_meds" JSONB,
    "decision" "OccReviewDecision" NOT NULL,
    "rationale" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occ_medical_reviews_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "occ_medical_reviews_order_id_key" ON "occ_medical_reviews" ("order_id");

CREATE TABLE IF NOT EXISTS "occ_consents" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "purpose" "OccConsentPurpose" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "scope" JSONB,
    "granted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "evidence_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occ_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "occ_consents_order_id_purpose_idx" ON "occ_consents" ("order_id", "purpose");

CREATE TABLE IF NOT EXISTS "occ_disclosures" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "audience" "OccDisclosureAudience" NOT NULL,
    "payload_kind" "OccDisclosurePayload" NOT NULL,
    "consent_id" INTEGER,
    "released_by" INTEGER,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occ_disclosures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "occ_disclosures_order_id_idx" ON "occ_disclosures" ("order_id");

-- ── Foreign keys ─────────────────────────────────────────────────────
DO $$ BEGIN ALTER TABLE "occ_test_subjects" ADD CONSTRAINT "occ_test_subjects_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_test_orders" ADD CONSTRAINT "occ_test_orders_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "occ_test_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_test_orders" ADD CONSTRAINT "occ_test_orders_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "occupational_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_samples" ADD CONSTRAINT "occ_samples_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "occ_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_custody_events" ADD CONSTRAINT "occ_custody_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "occ_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_custody_events" ADD CONSTRAINT "occ_custody_events_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "occ_samples"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_screening_results" ADD CONSTRAINT "occ_screening_results_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "occ_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_confirmatory_results" ADD CONSTRAINT "occ_confirmatory_results_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "occ_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_medical_reviews" ADD CONSTRAINT "occ_medical_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "occ_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_consents" ADD CONSTRAINT "occ_consents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "occ_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "occ_disclosures" ADD CONSTRAINT "occ_disclosures_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "occ_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
