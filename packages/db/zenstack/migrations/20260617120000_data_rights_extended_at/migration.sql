-- Ley 21.719: prórroga única (+30 días corridos) en solicitudes de derechos del
-- titular. extended_at sella cuándo se prorrogó (no-null => ya usada). Aditivo.
ALTER TABLE "data_rights_requests" ADD COLUMN IF NOT EXISTS "extended_at" TIMESTAMP(3);
