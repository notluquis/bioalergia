-- Reactivos: vitrina B2B + captación de leads.
--   1) QuoteProduct gana campos de vitrina pública (slug, descripción, imagen,
--      publishedOnSite, seoDescription) + link opcional a ClinicalAllergen.
--   2) ReactivoLead: leads desde la página pública /venta-empresas.
-- Aditivo + idempotente (regla repo: IF NOT EXISTS / DO-block, vía migrate deploy).
-- El precio (unit_price) NUNCA se expone en la vitrina pública.

-- 1) QuoteProduct — columnas de vitrina
ALTER TABLE "quote_products"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "image_url" TEXT,
  ADD COLUMN IF NOT EXISTS "published_on_site" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "seo_description" TEXT,
  ADD COLUMN IF NOT EXISTS "allergen_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "quote_products_slug_key" ON "quote_products"("slug");
CREATE INDEX IF NOT EXISTS "quote_products_published_on_site_idx" ON "quote_products"("published_on_site");
CREATE INDEX IF NOT EXISTS "quote_products_allergen_id_idx" ON "quote_products"("allergen_id");

DO $$ BEGIN
  ALTER TABLE "quote_products" ADD CONSTRAINT "quote_products_allergen_id_fkey"
    FOREIGN KEY ("allergen_id") REFERENCES "clinical_allergens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) ReactivoLead
DO $$ BEGIN
  CREATE TYPE "ReactivoLeadStatus" AS ENUM ('NUEVO', 'CONTACTADO', 'COTIZADO', 'CERRADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "reactivo_leads" (
    "id" SERIAL NOT NULL,
    "empresa" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "rut" TEXT,
    "message" TEXT,
    "products_of_interest" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "ReactivoLeadStatus" NOT NULL DEFAULT 'NUEVO',
    "source" TEXT NOT NULL DEFAULT 'venta-empresas',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reactivo_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reactivo_leads_status_idx" ON "reactivo_leads"("status");
CREATE INDEX IF NOT EXISTS "reactivo_leads_created_at_idx" ON "reactivo_leads"("created_at");
