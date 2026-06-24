-- Verificación pública unificada de documentos (recetas + certificados).
-- 100% aditivo + idempotente. NO DEPLOYAR automáticamente.
CREATE TABLE IF NOT EXISTS "document_verifications" (
  "id"              TEXT NOT NULL,
  "code"            TEXT NOT NULL,
  "document_type"   TEXT NOT NULL,
  "certificate_id"  TEXT,
  "prescription_id" TEXT,
  "pdf_hash"        TEXT,
  "issued_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at"      TIMESTAMP(3),
  CONSTRAINT "document_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_verifications_code_key"
  ON "document_verifications"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "document_verifications_certificate_id_key"
  ON "document_verifications"("certificate_id");

CREATE UNIQUE INDEX IF NOT EXISTS "document_verifications_prescription_id_key"
  ON "document_verifications"("prescription_id");

CREATE INDEX IF NOT EXISTS "document_verifications_code_idx"
  ON "document_verifications"("code");

-- FKs con ON DELETE SET NULL (borrar el doc no borra el registro de verificación;
-- queda huérfano → verifyByCode lo trata como inválido). Idempotente vía catálogo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_verifications_certificate_id_fkey'
  ) THEN
    ALTER TABLE "document_verifications"
      ADD CONSTRAINT "document_verifications_certificate_id_fkey"
      FOREIGN KEY ("certificate_id") REFERENCES "medical_certificates"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_verifications_prescription_id_fkey'
  ) THEN
    ALTER TABLE "document_verifications"
      ADD CONSTRAINT "document_verifications_prescription_id_fkey"
      FOREIGN KEY ("prescription_id") REFERENCES "medical_prescriptions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
