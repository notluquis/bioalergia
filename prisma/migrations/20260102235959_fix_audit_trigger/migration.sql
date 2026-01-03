-- Fix for audit trigger bug (column "old" does not exist or "id" missing)

-- 1. Create a safe ID extraction function
CREATE OR REPLACE FUNCTION audit.get_safe_id(record_json JSONB)
RETURNS TEXT AS $$
BEGIN
  -- Try to get 'id'
  IF record_json ? 'id' THEN
    RETURN (record_json->>'id');
  END IF;

  -- Try to get composite key for role_permissions (roleId, permissionId)
  IF record_json ? 'roleId' AND record_json ? 'permissionId' THEN
    RETURN (record_json->>'roleId') || '-' || (record_json->>'permissionId');
  END IF;

  -- Try to get composite key using snake_case (role_id, permission_id) just in case
  IF record_json ? 'role_id' AND record_json ? 'permission_id' THEN
    RETURN (record_json->>'role_id') || '-' || (record_json->>'permission_id');
  END IF;

  RETURN 'composite-id';
EXCEPTION WHEN OTHERS THEN
  RETURN 'error-getting-id';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Update the main log_change function to be safer
CREATE OR REPLACE FUNCTION audit.log_change()
RETURNS TRIGGER AS $$
DECLARE
  row_id_value TEXT;
  diff_data JSONB;
  old_data_json JSONB;
  new_data_json JSONB;
BEGIN
  -- Safely convert OLD/NEW to JSONB based on TG_OP
  -- (Avoid accessing OLD in INSERT or NEW in DELETE to prevent errors)
  IF TG_OP = 'INSERT' THEN
    old_data_json := NULL;
    new_data_json := to_jsonb(NEW);
    row_id_value := audit.get_safe_id(new_data_json);
  ELSIF TG_OP = 'DELETE' THEN
    old_data_json := to_jsonb(OLD);
    new_data_json := NULL;
    row_id_value := audit.get_safe_id(old_data_json);
  ELSIF TG_OP = 'UPDATE' THEN
    old_data_json := to_jsonb(OLD);
    new_data_json := to_jsonb(NEW);
    row_id_value := audit.get_safe_id(new_data_json);
  END IF;

  -- Calculate diff for UPDATEs
  IF TG_OP = 'UPDATE' THEN
    diff_data := audit.jsonb_diff(old_data_json, new_data_json);
    -- Skip if no real changes
    IF diff_data = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Insert log
  INSERT INTO audit.data_changes (table_name, row_id, operation, old_data, new_data, diff)
  VALUES (
    TG_TABLE_NAME,
    row_id_value,
    TG_OP,
    old_data_json,
    new_data_json,
    diff_data
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;