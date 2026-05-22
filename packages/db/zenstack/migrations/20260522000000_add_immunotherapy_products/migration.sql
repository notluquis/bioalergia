-- Presupuesto de inmunoterapia (ITA): catálogo editable de productos + etapas
-- de dosis (cobro al paciente), y campos de prestador institucional en
-- clinic_settings. Aditivo: solo crea objetos nuevos. El enum
-- "SubcutaneousVaccineProduct" ya existe en la DB.

-- CreateTable
CREATE TABLE "immunotherapy_products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lab" TEXT,
    "vaccine_product" "SubcutaneousVaccineProduct",
    "maintenance_target_ml" DECIMAL(5,2) NOT NULL DEFAULT 0.5,
    "maintenance_step_ml" DECIMAL(5,2) NOT NULL DEFAULT 0.25,
    "maintenance_default_qty" INTEGER NOT NULL DEFAULT 11,
    "default_discount_pct" DECIMAL(5,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "immunotherapy_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "immunotherapy_dose_stages" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "default_qty" INTEGER NOT NULL DEFAULT 1,
    "is_maintenance" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "immunotherapy_dose_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "immunotherapy_dose_stages_product_id_idx" ON "immunotherapy_dose_stages"("product_id");

-- AddForeignKey
ALTER TABLE "immunotherapy_dose_stages" ADD CONSTRAINT "immunotherapy_dose_stages_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "immunotherapy_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (prestador institucional)
ALTER TABLE "clinic_settings" ADD COLUMN "legal_name" TEXT;
ALTER TABLE "clinic_settings" ADD COLUMN "legal_rut" TEXT;
