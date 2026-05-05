-- Fix doctoralia_sync_logs primary key sequence out of sync.
-- Sequence drifted below MAX(id) after restore/bulk inserts,
-- causing duplicate key errors on new log creation.
SELECT setval(
  pg_get_serial_sequence('doctoralia_sync_logs', 'id'),
  COALESCE((SELECT MAX(id) FROM doctoralia_sync_logs), 0)
);
