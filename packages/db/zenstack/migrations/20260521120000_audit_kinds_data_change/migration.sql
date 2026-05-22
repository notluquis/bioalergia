-- Nuevos AuditEventKind para auditoría de diffs de datos (RETURNING old/new, PG18).
-- ADD VALUE IF NOT EXISTS es idempotente; no se usan en esta misma migración
-- (PG no permite usar un valor de enum recién agregado en la misma transacción).
ALTER TYPE "AuditEventKind" ADD VALUE IF NOT EXISTS 'DATA_UPDATE';
ALTER TYPE "AuditEventKind" ADD VALUE IF NOT EXISTS 'APPOINTMENT_CHANGE';
ALTER TYPE "AuditEventKind" ADD VALUE IF NOT EXISTS 'IMPORT_UPSERT';
ALTER TYPE "AuditEventKind" ADD VALUE IF NOT EXISTS 'FINANCIAL_CHANGE';
