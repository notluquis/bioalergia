-- shared-reminder (P2): recordatorios de adherencia por paciente. Aditivo + idempotente.

DO $$ BEGIN
  CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "reminder_schedules" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'EMAIL',
    "purpose" TEXT NOT NULL DEFAULT 'ADHERENCE_REMINDER',
    "subject_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reminder_schedules_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "reminder_schedules"
    ADD CONSTRAINT "reminder_schedules_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "reminder_schedules_status_run_at_idx" ON "reminder_schedules" ("status", "run_at");
CREATE INDEX IF NOT EXISTS "reminder_schedules_patient_id_idx" ON "reminder_schedules" ("patient_id");
