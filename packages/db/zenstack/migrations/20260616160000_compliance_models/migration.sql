-- Cumplimiento Ley 21.719 / Ley 20.584 / Decreto 35: derechos del titular (ARCO),
-- incidentes de brecha, lista de precios, reclamos, libros foliados.
-- Aditivo + idempotente (CREATE TABLE IF NOT EXISTS + FK idempotente).

-- #3 data_rights_requests (ARCO)
CREATE TABLE IF NOT EXISTS "data_rights_requests" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "requester_name" TEXT NOT NULL,
    "requester_rut" TEXT,
    "requester_email" TEXT,
    "patient_id" INTEGER,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "handled_by" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "data_rights_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "data_rights_requests_status_due_at_idx" ON "data_rights_requests"("status","due_at");

-- #4 breach_incidents
CREATE TABLE IF NOT EXISTS "breach_incidents" (
    "id" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "affected_data" TEXT,
    "affected_count" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DETECTED',
    "agency_notified_at" TIMESTAMP(3),
    "subjects_notified_at" TIMESTAMP(3),
    "handled_by" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "breach_incidents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "breach_incidents_status_detected_at_idx" ON "breach_incidents"("status","detected_at");

-- #10 price_list_items
CREATE TABLE IF NOT EXISTS "price_list_items" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "price_clp" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "price_list_items_code_key" ON "price_list_items"("code");
CREATE INDEX IF NOT EXISTS "price_list_items_category_sort_order_idx" ON "price_list_items"("category","sort_order");

-- #11 complaints
CREATE TABLE IF NOT EXISTS "complaints" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'PRESENCIAL',
    "complainant_name" TEXT NOT NULL,
    "complainant_rut" TEXT,
    "contact" TEXT,
    "patient_id" INTEGER,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "handled_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "complaints_status_due_at_idx" ON "complaints"("status","due_at");

-- #11 foliated_book_entries
CREATE TABLE IF NOT EXISTS "foliated_book_entries" (
    "id" TEXT NOT NULL,
    "book" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "foliated_book_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "foliated_book_entries_book_folio_key" ON "foliated_book_entries"("book","folio");
CREATE INDEX IF NOT EXISTS "foliated_book_entries_book_entry_date_idx" ON "foliated_book_entries"("book","entry_date");

-- FKs idempotentes (patient SET NULL)
DO $$ BEGIN
  ALTER TABLE "data_rights_requests" ADD CONSTRAINT "data_rights_requests_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "complaints" ADD CONSTRAINT "complaints_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
