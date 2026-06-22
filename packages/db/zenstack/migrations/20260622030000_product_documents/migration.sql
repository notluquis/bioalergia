-- shared-productdoc: fichas técnicas por producto (IFU/SDS/CoA...). Aditivo + idempotente.

DO $$ BEGIN
  CREATE TYPE "ProductDocumentType" AS ENUM ('IFU', 'SDS', 'COA', 'SPEC_SHEET', 'ISO_CERT', 'PACKAGE_INSERT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ProductDocumentVisibility" AS ENUM ('PUBLIC', 'AUTHED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "product_documents" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "type" "ProductDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "file_r2_key" TEXT NOT NULL,
    "visibility" "ProductDocumentVisibility" NOT NULL DEFAULT 'PUBLIC',
    "lot_number" TEXT,
    "version" TEXT,
    "language" TEXT NOT NULL DEFAULT 'es',
    "effective_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_documents_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "product_documents"
    ADD CONSTRAINT "product_documents_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "quote_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "product_documents_product_id_type_idx" ON "product_documents" ("product_id", "type");
