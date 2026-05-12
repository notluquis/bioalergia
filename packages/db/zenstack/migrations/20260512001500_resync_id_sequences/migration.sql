-- Re-sync every public.<table>_id_seq to MAX(id).
--
-- Background: historical CSV / SQL bulk-load operations inserted rows
-- with explicit `id` values that bypassed the sequence's nextval(),
-- so several sequences (calendar_sync_logs, calendar_sync_log_entries,
-- counterparts, users, …) were left far behind their MAX(id). Subsequent
-- ORM inserts blew up with "duplicate key value violates unique
-- constraint <table>_pkey".
--
-- This migration is idempotent: it walks every public sequence whose
-- name matches `<table>_id_seq` and bumps it to MAX(id). New tables
-- introduced after this migration are protected by the startup health
-- check (apps/api/src/lib/db-sequence-health.ts) that runs on each
-- API boot and warns (without blocking) when drift is detected.
SET search_path TO public, personal;

DO $$
DECLARE
  rec RECORD;
  max_id BIGINT;
BEGIN
  FOR rec IN
    SELECT
      c.table_name,
      c.table_name || '_id_seq' AS sequence_name
    FROM information_schema.columns c
    JOIN information_schema.sequences s
      ON s.sequence_name = c.table_name || '_id_seq'
     AND s.sequence_schema = c.table_schema
    WHERE c.column_name = 'id'
      AND c.data_type IN ('integer', 'bigint')
      AND c.table_schema = 'public'
  LOOP
    EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', rec.table_name)
      INTO max_id;
    IF max_id > 0 THEN
      PERFORM setval(rec.sequence_name, max_id);
    END IF;
  END LOOP;
END
$$;
