-- Zenstack Migration: Add calendar sync log entry model for structured logging

-- Add logEntries relationship table
CREATE TABLE IF NOT EXISTS "public"."calendar_sync_log_entries" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "sync_log_id" INTEGER NOT NULL,
  "message" TEXT,
  "severity" VARCHAR(255) NOT NULL DEFAULT 'info',
  "attributes" JSONB,
  "tags" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendar_sync_log_entries_sync_log_id_fkey" FOREIGN KEY ("sync_log_id") REFERENCES "public"."calendar_sync_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indices for optimal query performance
CREATE INDEX IF NOT EXISTS "calendar_sync_log_entries_sync_log_id_idx" ON "public"."calendar_sync_log_entries"("sync_log_id");
CREATE INDEX IF NOT EXISTS "calendar_sync_log_entries_timestamp_desc_idx" ON "public"."calendar_sync_log_entries"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "calendar_sync_log_entries_severity_idx" ON "public"."calendar_sync_log_entries"("severity");
