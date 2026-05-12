-- Audit log for clinical series merge operations.
-- When two series representing the same patient are merged, the source series is
-- deleted and all its events are re-pointed to the target series. This table
-- records the operation for audit and potential manual undo.

CREATE TABLE "clinical_series_merge_log" (
  "id"           BIGSERIAL    PRIMARY KEY,
  "source_id"    INT          NOT NULL,
  "target_id"    INT          NOT NULL REFERENCES "clinical_series"("id") ON DELETE CASCADE,
  "events_moved" INT          NOT NULL DEFAULT 0,
  "merged_by"    INT          REFERENCES "users"("id") ON DELETE SET NULL,
  "merge_reason" TEXT,
  "is_auto"      BOOLEAN      NOT NULL DEFAULT FALSE,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX "clinical_series_merge_log_target_id_idx" ON "clinical_series_merge_log"("target_id");
CREATE INDEX "clinical_series_merge_log_source_id_idx" ON "clinical_series_merge_log"("source_id");
