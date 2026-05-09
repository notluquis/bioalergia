-- Multi-schema datasource (public, personal): force search_path so unqualified table refs resolve to public in shadow DB rebuild.
SET search_path TO public, personal;

-- Enrich clinical series with vaccine product, health insurance, and delivery modality.
--
-- SubcutaneousVaccineProduct: which product the patient receives.
--   CLUSTOID / CLUSTOID_FORTE / CLUSTOID_B120 — Clustoid and its concentration variants
--   (Cluxin and Clustek are trade names for the same product.)
--   ALXOID — Alxoid allergen extract
--   ORAL_TEC — Oral-Tec sublingual/oral product
--
-- HealthInsuranceType: patient's health coverage (detected from event descriptions).
--   FONASA / ISAPRE / PARTICULAR
--
-- DeliveryModality: how doses are delivered.
--   PRESENCIAL — patient attends the clinic
--   DOMICILIO — dose sent to home / picked up by caregiver

CREATE TYPE "SubcutaneousVaccineProduct" AS ENUM (
  'CLUSTOID', 'CLUSTOID_FORTE', 'CLUSTOID_B120', 'ALXOID', 'ORAL_TEC'
);

CREATE TYPE "HealthInsuranceType" AS ENUM ('FONASA', 'ISAPRE', 'PARTICULAR');

CREATE TYPE "DeliveryModality" AS ENUM ('PRESENCIAL', 'DOMICILIO');

ALTER TABLE "clinical_series"
  ADD COLUMN "vaccine_product"    "SubcutaneousVaccineProduct",
  ADD COLUMN "health_insurance"   "HealthInsuranceType",
  ADD COLUMN "delivery_modality"  "DeliveryModality";
