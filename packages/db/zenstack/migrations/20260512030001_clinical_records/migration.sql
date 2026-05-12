-- Clinical records (fichas clínicas) — separate pipeline from skin tests.
--
-- Source xlsx files in OneDrive that match the "ficha clínica" pattern
-- (filename = patient name without _PRICK / _MULTITEST prefix) used to
-- accumulate as REJECTED rows in clinical_skin_test_imports because the
-- skin-test parser couldn't process them. We add a dedicated import
-- queue (clinical_record_imports) and a parsed-record table
-- (clinical_records), and reclassify all matching REJECTED rows from
-- the skin-test queue into the new queue with status PENDING_REVIEW so
-- the operator can decide each one.
--
-- The skin-test queue keeps the original row marked with the new
-- status MOVED_TO_RECORD to preserve provenance + audit trail.
--
-- Refs:
--   - HHS HIPAA §164.312(b) audit controls
--   - Chile Ley 20.584 + Reglamento DS 41/2012 ficha clínica
SET search_path TO public, personal;

-- ----------------------------------------------------------------------
-- Enum (ClinicalSeriesKind + ClinicalSkinTestImportStatus extensions
-- shipped in 20260512030000_clinical_records_enum_extend so the new
-- values are committed before this migration uses them.)
-- ----------------------------------------------------------------------

-- Status enum for the new queue mirrors the skin-test queue.
DO $$ BEGIN
  CREATE TYPE "ClinicalRecordImportStatus" AS ENUM (
    'DISCOVERED','PENDING_REVIEW','IMPORTED','REJECTED','ERROR','SKIPPED','TEMPLATE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------
-- clinical_record_imports — mirror of clinical_skin_test_imports
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "clinical_record_imports" (
  "id"                              TEXT PRIMARY KEY,
  "onedrive_account_id"             TEXT,
  "onedrive_item_id"                TEXT NOT NULL,
  "onedrive_drive_id"               TEXT,
  "onedrive_source_key"             TEXT,
  "onedrive_source_drive_id"        TEXT,
  "onedrive_source_item_id"         TEXT,
  "onedrive_sharepoint_unique_id"   TEXT,
  "onedrive_quick_xor_hash"         TEXT,
  "onedrive_sha1_hash"              TEXT,
  "onedrive_crc32_hash"             TEXT,
  "onedrive_etag"                   TEXT,
  "onedrive_ctag"                   TEXT,
  "onedrive_web_url"                TEXT,
  "path"                            TEXT,
  "filename"                        TEXT NOT NULL,
  "mime_type"                       TEXT,
  "size"                            INTEGER,
  "modified_at"                     TIMESTAMPTZ(3),
  "parser_version"                  TEXT NOT NULL,
  "status"                          "ClinicalRecordImportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "confidence"                      INTEGER NOT NULL DEFAULT 0,
  "error"                           TEXT,
  "issues"                          JSONB,
  "parsed_payload"                  JSONB,
  "result_hash"                     TEXT,
  "duplicate_of_import_id"          TEXT,
  "matched_patient_id"              INTEGER,
  "matched_clinical_series_id"      INTEGER,
  "match_candidates"                JSONB,
  "reviewed_by"                     INTEGER,
  "reviewed_at"                     TIMESTAMPTZ(3),
  "review_notes"                    TEXT,
  "imported_at"                     TIMESTAMPTZ(3),
  "created_at"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clinical_record_imports_account_drive_item_unique
    UNIQUE NULLS NOT DISTINCT ("onedrive_account_id", "onedrive_drive_id", "onedrive_item_id"),
  CONSTRAINT clinical_record_imports_account_fkey
    FOREIGN KEY ("onedrive_account_id") REFERENCES onedrive_accounts(account_id) ON DELETE SET NULL,
  CONSTRAINT clinical_record_imports_patient_fkey
    FOREIGN KEY ("matched_patient_id") REFERENCES patients(id) ON DELETE SET NULL,
  CONSTRAINT clinical_record_imports_series_fkey
    FOREIGN KEY ("matched_clinical_series_id") REFERENCES clinical_series(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS clinical_record_imports_status_idx ON clinical_record_imports(status);
CREATE INDEX IF NOT EXISTS clinical_record_imports_modified_idx ON clinical_record_imports(modified_at);
CREATE INDEX IF NOT EXISTS clinical_record_imports_account_idx ON clinical_record_imports(onedrive_account_id);
CREATE INDEX IF NOT EXISTS clinical_record_imports_patient_idx ON clinical_record_imports(matched_patient_id);

-- ----------------------------------------------------------------------
-- clinical_records — parsed ficha clínica payload, one per consultation.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "clinical_records" (
  "id"                  TEXT PRIMARY KEY,
  "clinical_series_id"  INTEGER NOT NULL,
  "source_import_id"    TEXT NOT NULL UNIQUE,
  "consult_date"        DATE,
  "patient_name"        TEXT,
  "age_label"           TEXT,
  "history"             TEXT,
  "physical_exam"       TEXT,
  "diagnosis"           TEXT,
  "indications"         JSONB,
  "weight_kg"           NUMERIC(6,2),
  "height_cm"           NUMERIC(6,2),
  "head_circumference_cm" NUMERIC(6,2),
  "anthropometric"      JSONB,
  "raw_header"          JSONB,
  "raw_sections"        JSONB,
  "result_hash"         TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clinical_records_series_fkey
    FOREIGN KEY ("clinical_series_id") REFERENCES clinical_series(id) ON DELETE CASCADE,
  CONSTRAINT clinical_records_import_fkey
    FOREIGN KEY ("source_import_id") REFERENCES clinical_record_imports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS clinical_records_series_idx ON clinical_records(clinical_series_id);
CREATE INDEX IF NOT EXISTS clinical_records_consult_date_idx ON clinical_records(consult_date);

-- ----------------------------------------------------------------------
-- Reclassify: clinical_skin_test_imports.status = REJECTED whose
-- filename matches the ficha clínica pattern (no _ prefix and not
-- "test" / "prick" / "multitest" anywhere) get a copy in the new queue
-- with status PENDING_REVIEW. Original rows get status MOVED_TO_RECORD.
--
-- Pattern detection is intentionally permissive — operator validates
-- in PENDING_REVIEW; false positives are reclassifiable later.
-- ----------------------------------------------------------------------
WITH source AS (
  SELECT id
  FROM clinical_skin_test_imports
  WHERE status = 'REJECTED'
    AND filename NOT LIKE '\_%'      -- no leading underscore (skin tests use _PRICK / _MULTITEST)
    AND filename ILIKE '%.xlsx'
    AND filename !~* '(prick|multitest|patch test|test cutan)'
),
inserted AS (
  INSERT INTO clinical_record_imports (
    id,
    onedrive_account_id, onedrive_item_id, onedrive_drive_id,
    onedrive_source_key, onedrive_source_drive_id, onedrive_source_item_id,
    onedrive_sharepoint_unique_id, onedrive_quick_xor_hash, onedrive_sha1_hash,
    onedrive_crc32_hash, onedrive_etag, onedrive_ctag, onedrive_web_url,
    path, filename, mime_type, size, modified_at,
    parser_version, status, confidence, created_at, updated_at
  )
  SELECT
    'crri_' || i.id,                        -- prefix to avoid PK collision
    i.onedrive_account_id, i.onedrive_item_id, i.onedrive_drive_id,
    i.onedrive_source_key, i.onedrive_source_drive_id, i.onedrive_source_item_id,
    i.onedrive_sharepoint_unique_id, i.onedrive_quick_xor_hash, i.onedrive_sha1_hash,
    i.onedrive_crc32_hash, i.onedrive_etag, i.onedrive_ctag, i.onedrive_web_url,
    i.path, i.filename, i.mime_type, i.size, i.modified_at,
    '0.0.0', 'PENDING_REVIEW'::"ClinicalRecordImportStatus", 0, now(), now()
  FROM clinical_skin_test_imports i
  JOIN source s ON s.id = i.id
  ON CONFLICT (onedrive_account_id, onedrive_drive_id, onedrive_item_id) DO NOTHING
  RETURNING id
)
UPDATE clinical_skin_test_imports
SET status = 'MOVED_TO_RECORD'::"ClinicalSkinTestImportStatus",
    review_notes = COALESCE(review_notes, '') ||
                   E'\n[migration 20260512030000] reclassified to clinical_record_imports',
    updated_at = now()
WHERE id IN (SELECT id FROM source);
