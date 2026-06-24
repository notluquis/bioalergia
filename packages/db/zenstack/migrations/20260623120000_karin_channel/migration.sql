-- Canal de denuncia Ley Karin (Ley 21.643 + Decreto 21/2024). Recibe denuncias
-- IDENTIFICADAS de acoso laboral / sexual / violencia en el trabajo (Anexo A).
-- Acceso restringido (subject CASL `KarinReport`). Sin relaciones FK.
-- Aditivo + idempotente (CREATE TABLE IF NOT EXISTS).
--
-- NEEDS REVIEW: escrita a mano (no generada con `zen migrate dev --create-only`
-- porque no hay conexión segura a la DB de prod). Revisar contra el modelo
-- KarinReport en schema.zmodel y aplicar con `zen migrate deploy` (NUNCA db push).

CREATE TABLE IF NOT EXISTS "karin_reports" (
    "id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "reporter_name" TEXT NOT NULL,
    "reporter_rut" TEXT,
    "reporter_contact" TEXT,
    "reported_person" TEXT,
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RECIBIDA',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resguardo_due_at" TIMESTAMP(3) NOT NULL,
    "remitir_due_at" TIMESTAMP(3) NOT NULL,
    "investigation_due_at" TIMESTAMP(3) NOT NULL,
    "resolution" TEXT,
    "handled_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "karin_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "karin_reports_status_remitir_due_at_idx" ON "karin_reports"("status","remitir_due_at");
