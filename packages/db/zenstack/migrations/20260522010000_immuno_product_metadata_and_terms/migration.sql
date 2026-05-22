-- Metadata de composición/potencia por producto (UT/mL, por-alérgeno, máx
-- alérgenos) + términos/condiciones económicas editables del presupuesto.
-- Aditivo: solo agrega columnas.

-- AlterTable: composición producto
ALTER TABLE "immunotherapy_products" ADD COLUMN "concentration_ut_ml" INTEGER;
ALTER TABLE "immunotherapy_products" ADD COLUMN "per_allergen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "immunotherapy_products" ADD COLUMN "max_allergens" INTEGER;

-- AlterTable: términos del presupuesto (disclosures económicos)
ALTER TABLE "clinic_settings" ADD COLUMN "immuno_budget_terms" TEXT;
