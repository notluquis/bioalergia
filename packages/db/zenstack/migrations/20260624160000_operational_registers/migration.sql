-- Registros operativos / sanitarios exigibles por la SEREMI (DS 283, BIO-RG-001,
-- REAS DS 6/2009, DS 44/2024). Un único modelo `OperationalRegister` cubre los 7
-- tipos de registro; los campos específicos por tipo viven en `data` (JSONB).
-- Sin relaciones FK. Aditivo + idempotente (CREATE TABLE/INDEX IF NOT EXISTS).
--
-- NEEDS REVIEW: escrita a mano (no generada con `zen migrate dev --create-only`
-- porque no hay conexión segura a la DB de prod). Revisar contra el modelo
-- OperationalRegister en schema.zmodel y aplicar con `zen migrate deploy`
-- (NUNCA db push).

CREATE TABLE IF NOT EXISTS "operational_registers" (
    "id" TEXT NOT NULL,
    "register_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT,
    "due_at" TIMESTAMP(3),
    "attachment_url" TEXT,
    "signed_by" TEXT,
    "recorded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operational_registers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "operational_registers_register_type_occurred_at_idx" ON "operational_registers"("register_type","occurred_at");
