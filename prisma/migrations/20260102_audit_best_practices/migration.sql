-- Best Practices Improvements for Audit System
-- Based on 2026 PostgreSQL community recommendations

-- Ensure schema exists (fixes Shadow DB ordering issue where this runs before audit_system)
CREATE SCHEMA IF NOT EXISTS audit;

DO $$
BEGIN
  -- Only run if the table exists (it might not in Shadow DB due to alphabetical ordering)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'audit' AND tablename = 'data_changes') THEN
    -- 1. GIN Index on JSONB for efficient queries
    CREATE INDEX IF NOT EXISTS idx_audit_diff_gin ON audit.data_changes USING GIN (diff);
    CREATE INDEX IF NOT EXISTS idx_audit_old_data_gin ON audit.data_changes USING GIN (old_data);
    CREATE INDEX IF NOT EXISTS idx_audit_new_data_gin ON audit.data_changes USING GIN (new_data);

    -- 2. Security: Prevent accidental deletion of audit data
    REVOKE DELETE ON audit.data_changes FROM PUBLIC;

    -- 3. Add user tracking column (for future use)
    ALTER TABLE audit.data_changes ADD COLUMN IF NOT EXISTS changed_by TEXT;

-- 4. Add app context column (for API endpoint tracking)
ALTER TABLE audit.data_changes
ADD COLUMN IF NOT EXISTS app_context TEXT;

-- 5. Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_table_time ON audit.data_changes (table_name, created_at DESC);

END IF;

END $$;