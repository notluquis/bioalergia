-- Convert event timestamp columns from timestamp to timestamptz.
-- Values are stored as UTC, so we tag them as UTC during conversion.

ALTER TABLE events
  ALTER COLUMN start_date_time TYPE TIMESTAMPTZ(3) USING start_date_time AT TIME ZONE 'UTC',
  ALTER COLUMN end_date_time TYPE TIMESTAMPTZ(3) USING end_date_time AT TIME ZONE 'UTC',
  ALTER COLUMN event_created_at TYPE TIMESTAMPTZ(3) USING event_created_at AT TIME ZONE 'UTC',
  ALTER COLUMN event_updated_at TYPE TIMESTAMPTZ(3) USING event_updated_at AT TIME ZONE 'UTC';
