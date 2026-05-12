-- Enum extensions for clinical records pipeline. Separate from the
-- main migration because Postgres forbids using a freshly-added enum
-- value in the same transaction; the `UPDATE … SET status = 'MOVED_TO_RECORD'`
-- in the next migration depends on this addition having committed.
SET search_path TO public, personal;
ALTER TYPE "ClinicalSeriesKind" ADD VALUE IF NOT EXISTS 'MEDICAL_CONSULTATION';
ALTER TYPE "ClinicalSkinTestImportStatus" ADD VALUE IF NOT EXISTS 'MOVED_TO_RECORD';
