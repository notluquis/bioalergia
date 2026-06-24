CREATE TABLE IF NOT EXISTS "public"."mercadopago_import_changes" (
  "id" BIGSERIAL PRIMARY KEY,
  "sync_log_id" BIGINT NOT NULL,
  "report_type" TEXT NOT NULL,
  "source_id" VARCHAR(100) NOT NULL,
  "field_name" TEXT NOT NULL,
  "old_value" JSONB,
  "new_value" JSONB,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mercadopago_import_changes_sync_log_id_fkey"
    FOREIGN KEY ("sync_log_id")
    REFERENCES "public"."sync_logs"("id")
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT "mercadopago_import_changes_report_type_check"
    CHECK ("report_type" IN ('release', 'settlement'))
);

CREATE INDEX IF NOT EXISTS "mercadopago_import_changes_sync_log_id_idx"
  ON "public"."mercadopago_import_changes" ("sync_log_id");

CREATE INDEX IF NOT EXISTS "mercadopago_import_changes_source_id_idx"
  ON "public"."mercadopago_import_changes" ("source_id");

CREATE INDEX IF NOT EXISTS "mercadopago_import_changes_field_name_idx"
  ON "public"."mercadopago_import_changes" ("field_name");

CREATE INDEX IF NOT EXISTS "mercadopago_import_changes_changed_at_idx"
  ON "public"."mercadopago_import_changes" ("changed_at" DESC);

CREATE INDEX IF NOT EXISTS "mercadopago_import_changes_report_type_source_id_idx"
  ON "public"."mercadopago_import_changes" ("report_type", "source_id");
