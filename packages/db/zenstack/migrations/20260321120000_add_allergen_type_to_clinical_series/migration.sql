-- Multi-schema datasource (public, personal): force search_path so unqualified table refs resolve to public in shadow DB rebuild.
SET search_path TO public, personal;

-- Add allergen type classification to subcutaneous treatment series.
-- Tracks which allergen(s) the treatment targets:
--   ACAROS          — dust mites only ("clustoid ácaros")
--   GRAMINEAS       — grass pollen only ("clustoid gramíneas")
--   ACAROS_GRAMINEAS — both; the default when events just say "clustoid"

CREATE TYPE "SubcutaneousAllergenType" AS ENUM ('ACAROS', 'GRAMINEAS', 'ACAROS_GRAMINEAS');

ALTER TABLE "clinical_series"
  ADD COLUMN "allergen_type" "SubcutaneousAllergenType";
