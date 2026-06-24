-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Job Radar — JobPosting (búsqueda de empleo personal, schema personal)
-- Generado a mano (no via zen migrate, por drift en prod) — aplicar con:
--   pnpm -F @finanzas/db migrate:deploy
-- Idempotente: CREATE TYPE en DO block + IF NOT EXISTS en tabla/índices.
-- 100% aditivo (no toca tablas existentes).
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateEnum (CREATE TYPE no soporta IF NOT EXISTS → DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'JobPostingStatus' AND n.nspname = 'personal'
  ) THEN
    CREATE TYPE "personal"."JobPostingStatus" AS ENUM ('OPEN', 'CLOSED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'JobApplicationStatus' AND n.nspname = 'personal'
  ) THEN
    CREATE TYPE "personal"."JobApplicationStatus" AS ENUM
      ('NEW', 'SEEN', 'INTERESTED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'DISCARDED');
  END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "personal"."job_postings" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "department" TEXT,
    "location" TEXT,
    "remote" TEXT,
    "description_html" TEXT,
    "published_at" TIMESTAMP(3),
    "lastmod" TIMESTAMP(3),
    "status" "personal"."JobPostingStatus" NOT NULL DEFAULT 'OPEN',
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "application_status" "personal"."JobApplicationStatus" NOT NULL DEFAULT 'NEW',
    "applied_at" TIMESTAMP(3),
    "status_updated_at" TIMESTAMP(3),
    "notes" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "job_postings_source_company_external_id_key"
  ON "personal"."job_postings"("source", "company", "external_id");

CREATE INDEX IF NOT EXISTS "job_postings_status_idx"
  ON "personal"."job_postings"("status");

CREATE INDEX IF NOT EXISTS "job_postings_notified_idx"
  ON "personal"."job_postings"("notified");

CREATE INDEX IF NOT EXISTS "job_postings_application_status_idx"
  ON "personal"."job_postings"("application_status");

CREATE INDEX IF NOT EXISTS "job_postings_first_seen_at_idx"
  ON "personal"."job_postings"("first_seen_at");
