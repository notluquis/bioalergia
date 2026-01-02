-- Best Practices Improvements for Audit System
-- Based on 2026 PostgreSQL community recommendations

-- 1. GIN Index on JSONB for efficient queries
-- (Allows fast searching within diff/old_data/new_data)
CREATE INDEX IF NOT EXISTS idx_audit_diff_gin ON audit.data_changes USING GIN (diff);

CREATE INDEX IF NOT EXISTS idx_audit_old_data_gin ON audit.data_changes USING GIN (old_data);

CREATE INDEX IF NOT EXISTS idx_audit_new_data_gin ON audit.data_changes USING GIN (new_data);

-- 2. Security: Prevent accidental deletion of audit data
-- Only superuser can delete from audit table
REVOKE DELETE ON audit.data_changes FROM PUBLIC;

-- 3. Add user tracking column (for future use)
-- This allows tracking WHO made the change when available
ALTER TABLE audit.data_changes
ADD COLUMN IF NOT EXISTS changed_by TEXT;

-- 4. Add app context column (for API endpoint tracking)
ALTER TABLE audit.data_changes
ADD COLUMN IF NOT EXISTS app_context TEXT;

-- 5. Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_table_time ON audit.data_changes (table_name, created_at DESC);