-- Add `superintendenciaNumber` to ClinicSettings (free-text Superintendencia
-- de Salud prestador code; rendered under the doctor signature on every
-- exam-report PDF). Nullable so the singleton row keeps rendering "—" until
-- the operator fills it from /settings/clinic.
ALTER TABLE "public"."clinic_settings"
  ADD COLUMN "superintendencia_number" TEXT;

-- Add `tags` to ClinicalAllergen (string[]). Used by the exam-report PDF
-- generator to auto-detect cross-reactive components (PR-10, profilin,
-- tropomyosin, LTP) and append the EAACI cross-reactivity disclaimer.
-- Default = empty array so existing rows stay valid.
ALTER TABLE "public"."clinical_allergens"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
