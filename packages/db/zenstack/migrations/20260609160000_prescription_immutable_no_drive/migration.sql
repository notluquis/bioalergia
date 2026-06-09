-- Recetas inmutables sin Drive: el PDF se regenera determinísticamente desde la
-- fila (fuente de verdad única), no se archiva en Drive ni se guarda el hash.
-- Aditivo + idempotente. NO DEPLOYAR automáticamente.
ALTER TABLE "medical_prescriptions" ALTER COLUMN "drive_file_id" DROP NOT NULL;
ALTER TABLE "medical_prescriptions" ALTER COLUMN "pdf_hash" DROP NOT NULL;
