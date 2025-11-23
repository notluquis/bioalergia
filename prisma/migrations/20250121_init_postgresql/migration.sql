-- CreateTable
CREATE TABLE "google_calendar_events" (
    "calendar_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_status" TEXT,
    "event_type" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "start_date" TIMESTAMP(3),
    "start_date_time" TIMESTAMP(3),
    "start_time_zone" TEXT,
    "end_date" TIMESTAMP(3),
    "end_date_time" TIMESTAMP(3),
    "end_time_zone" TEXT,
    "event_created_at" TIMESTAMP(3),
    "event_updated_at" TIMESTAMP(3),
    "color_id" TEXT,
    "location" TEXT,
    "transparency" TEXT,
    "visibility" TEXT,
    "hangout_link" TEXT,
    "category" TEXT,
    "amount_expected" INTEGER,
    "amount_paid" INTEGER,
    "attended" BOOLEAN,
    "dosage" TEXT,
    "treatment_stage" TEXT,
    "raw_event" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_events_pkey" PRIMARY KEY ("calendar_id","event_id")
);

-- CreateTable
CREATE TABLE "google_calendar_sync_log" (
    "id" BIGSERIAL NOT NULL,
    "trigger_source" TEXT NOT NULL,
    "trigger_user_id" INTEGER,
    "trigger_label" TEXT,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3),
    "inserted" INTEGER,
    "updated" INTEGER,
    "skipped" INTEGER,
    "excluded" INTEGER,
    "error_message" TEXT,

    CONSTRAINT "google_calendar_sync_log_pkey" PRIMARY KEY ("id")
);
