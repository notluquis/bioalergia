-- Clinical-record READ audit log — additive, idempotent.
-- Legal basis: Decreto 41/2012 art. 9 + Ley 20.584 (registrar quién accedió a
-- la ficha clínica y cuándo). Run by a human via psql against prod, NOT
-- `zen migrate deploy` (repo rule: cambios aditivos vía psql IF NOT EXISTS —
-- prod tiene drift). After running, `pnpm -F @finanzas/db build` keeps the
-- generated client in sync (schema.zmodel already carries these).
--
--   psql "$DATABASE_URL" -f clinical_read_audit.sql

ALTER TYPE "AuditEventKind" ADD VALUE IF NOT EXISTS 'CLINICAL_RECORD_READ';
ALTER TYPE "AuditEventKind" ADD VALUE IF NOT EXISTS 'CLINICAL_DOCUMENT_VIEW';

-- By-subject access index (who read patient X over 15 years). CONCURRENTLY so
-- it never locks audit_logs writes; run outside a txn block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_resource_resource_id_occurred_at_idx"
  ON "audit_logs" ("resource", "resource_id", "occurred_at");
