-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: shared XLSX snapshot on clinical_xlsx_files
-- Generado a mano (prod drift) — aplicar con: pnpm -F @finanzas/db migrate:deploy
-- 100% aditivo + idempotente (ADD COLUMN IF NOT EXISTS). No toca datos.
--
-- Guarda la primera hoja estructurada del xlsx en la librería compartida, para
-- que tanto tests cutáneos como fichas clínicas re-parseen desde DB en vez de
-- re-descargar de OneDrive. snapshot_etag/ctag = tags al archivar; si difieren
-- de onedrive_etag/ctag (refrescados por el scan) → STALE → re-descargar.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "clinical_xlsx_files"
  ADD COLUMN IF NOT EXISTS "snapshot_status"            TEXT,
  ADD COLUMN IF NOT EXISTS "snapshot_json"              JSONB,
  ADD COLUMN IF NOT EXISTS "snapshot_etag"              TEXT,
  ADD COLUMN IF NOT EXISTS "snapshot_ctag"              TEXT,
  ADD COLUMN IF NOT EXISTS "snapshot_extractor_version" TEXT,
  ADD COLUMN IF NOT EXISTS "snapshot_cell_count"        INTEGER,
  ADD COLUMN IF NOT EXISTS "snapshot_archived_at"       TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "snapshot_error"             TEXT;

-- Partial index: quickly find files still needing a snapshot for a feature.
CREATE INDEX IF NOT EXISTS "clinical_xlsx_files_snapshot_status_idx"
  ON "clinical_xlsx_files" ("snapshot_status");
