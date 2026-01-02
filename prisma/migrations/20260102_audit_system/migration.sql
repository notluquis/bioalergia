-- Schema separado para auditoría (protege de borrados accidentales de tablas public)
CREATE SCHEMA IF NOT EXISTS audit;

-- Tabla principal de cambios
CREATE TABLE audit.data_changes (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (
        operation IN ('INSERT', 'UPDATE', 'DELETE')
    ),
    old_data JSONB,
    new_data JSONB,
    diff JSONB, -- Solo campos modificados (para UPDATEs)
    transaction_id BIGINT DEFAULT txid_current(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    exported_at TIMESTAMPTZ -- NULL = no exportado aún a Drive
);

-- Índices para queries eficientes
CREATE INDEX idx_audit_table ON audit.data_changes (table_name);

CREATE INDEX idx_audit_created ON audit.data_changes (created_at);

CREATE INDEX idx_audit_not_exported ON audit.data_changes (exported_at)
WHERE
    exported_at IS NULL;

CREATE INDEX idx_audit_row ON audit.data_changes (table_name, row_id);

-- Función para calcular diff de JSONB (solo campos que cambiaron)
CREATE OR REPLACE FUNCTION audit.jsonb_diff(old_data JSONB, new_data JSONB)
RETURNS JSONB AS $$
  SELECT COALESCE(
    jsonb_object_agg(key, new_data->key),
    '{}'::jsonb
  )
  FROM jsonb_object_keys(new_data) AS key
  WHERE old_data->key IS DISTINCT FROM new_data->key;
$$ LANGUAGE sql IMMUTABLE;

-- Trigger function genérica para logging
CREATE OR REPLACE FUNCTION audit.log_change()
RETURNS TRIGGER AS $$
DECLARE
  row_id_value TEXT;
  diff_data JSONB;
BEGIN
  -- Obtener ID de la fila (asume columna 'id')
  row_id_value := COALESCE(
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::TEXT,
    'unknown'
  );
  
  -- Calcular diff para UPDATEs
  IF TG_OP = 'UPDATE' THEN
    diff_data := audit.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW));
    -- Skip si no hay cambios reales (ej: UPDATE con mismos valores)
    IF diff_data = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;
  
  INSERT INTO audit.data_changes (table_name, row_id, operation, old_data, new_data, diff)
  VALUES (
    TG_TABLE_NAME,
    row_id_value,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    diff_data
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas principales
-- Excluir: migraciones, logs, y la propia tabla de audit
DO $$
DECLARE
  tbl RECORD;
  excluded_tables TEXT[] := ARRAY[
    '_prisma_migrations',
    'backup_logs', 
    'sync_logs',
    'audit_logs'
  ];
BEGIN
  FOR tbl IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename != ALL(excluded_tables)
  LOOP
    -- Eliminar trigger si existe
    EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON public.%I', tbl.tablename);
    
    -- Crear nuevo trigger
    EXECUTE format(
      'CREATE TRIGGER audit_trigger
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION audit.log_change()',
      tbl.tablename
    );
    
    RAISE NOTICE 'Created audit trigger on table: %', tbl.tablename;
  END LOOP;
END;
$$;

-- Vista útil para ver cambios recientes
CREATE OR REPLACE VIEW audit.recent_changes AS
SELECT
    id,
    table_name,
    row_id,
    operation,
    diff,
    created_at,
    CASE
        WHEN exported_at IS NOT NULL THEN 'exported'
        ELSE 'pending'
    END as status
FROM audit.data_changes
ORDER BY created_at DESC
LIMIT 100;