CREATE INDEX IF NOT EXISTS "sync_logs_trigger_source_idx" ON "sync_logs"("trigger_source");
CREATE INDEX IF NOT EXISTS "sync_logs_started_at_idx" ON "sync_logs"("started_at");
