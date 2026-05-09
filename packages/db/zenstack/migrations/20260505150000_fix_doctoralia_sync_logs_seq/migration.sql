-- Fix doctoralia_sync_logs primary key sequence out of sync.
-- Sequence drifted below MAX(id) after restore/bulk inserts,
-- causing duplicate key errors on new log creation.
-- GREATEST(..., 1) avoids `setval(seq, 0)` which violates the
-- sequence min on the empty shadow DB during `migrate dev`.
SET search_path TO public, personal;
SELECT setval(
  pg_get_serial_sequence('doctoralia_sync_logs', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM doctoralia_sync_logs), 0), 1)
);
