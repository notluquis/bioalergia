-- Skin-test exam reports — generic structured reports, printable as PDF.
-- Polymorphic ExamReport + per-section reactions. Conclusion phrases live
-- in conclusion_templates (DB-managed via UI). Footer/clinic info lives in
-- clinic_settings (singleton). All additive; no data is dropped.

CREATE TYPE "ExamType" AS ENUM (
  'PATCH', 'MULTITEST_PANELS', 'FOOD_PANEL', 'AEROALLERGENS_I', 'AEROALLERGENS_II'
);

CREATE TYPE "SkinReaction" AS ENUM ('NEGATIVA', 'DEBIL', 'MODERADA', 'FUERTE');

-- Singleton settings row. Footer info, clinic identity, defaults.
CREATE TABLE "clinic_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL DEFAULT 'Bioalergia',
  "address" TEXT NOT NULL DEFAULT 'San Martín 870, Edificio Caram, Torre B, Of. 208 A – 208 B, Concepción',
  "phone_whatsapp" TEXT NOT NULL DEFAULT '+569 30963316',
  "phone_landline" TEXT NOT NULL DEFAULT '(41) 33355293',
  "email" TEXT NOT NULL DEFAULT 'contacto@bioalergia.cl',
  "website" TEXT NOT NULL DEFAULT 'www.bioalergia.cl',
  "website_secondary" TEXT NOT NULL DEFAULT 'www.jmmmartinez-alergia-inmunologia.com/',
  "default_reagents" TEXT NOT NULL DEFAULT 'Inmunotek - Diater España',
  "default_technique" TEXT NOT NULL DEFAULT 'Método Doan T Zeiss Modificado',
  "doctor_name" TEXT NOT NULL DEFAULT 'DR JOSE MANUEL MARTINEZ M.',
  "doctor_specialty" TEXT NOT NULL DEFAULT 'ALERGOLOGO-INMUNOLOGO',
  "doctor_rut" TEXT,
  "signature_url" TEXT,
  "papule_threshold_mm" DECIMAL(5, 2) NOT NULL DEFAULT 3.0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "clinic_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinic_settings_singleton" CHECK ("id" = 1)
);

-- Seed the singleton row so the UI has something to read on day 1.
INSERT INTO "clinic_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE "conclusion_templates" (
  "id" SERIAL NOT NULL,
  "text" TEXT NOT NULL,
  "exam_type" "ExamType",
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conclusion_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conclusion_templates_exam_type_idx" ON "conclusion_templates" ("exam_type");

-- Seed the universally-used conclusion (visible in every PDF screenshot).
INSERT INTO "conclusion_templates" ("text", "is_default", "is_active", "position")
VALUES ('Piel reactiva valida el examen', true, true, 0)
ON CONFLICT DO NOTHING;

CREATE TABLE "exam_reports" (
  "id" SERIAL NOT NULL,
  "patient_id" INTEGER NOT NULL,
  "exam_type" "ExamType" NOT NULL,
  "conclusion_text" TEXT NOT NULL,
  "conclusion_template_id" INTEGER,
  "reagents" TEXT,
  "technique" TEXT,
  "notes" TEXT,
  "doctor_name" TEXT NOT NULL,
  "doctor_specialty" TEXT NOT NULL,
  "doctor_rut" TEXT,
  "generated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" INTEGER,

  CONSTRAINT "exam_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_reports_patient_id_fkey" FOREIGN KEY ("patient_id")
    REFERENCES "patients" ("id") ON DELETE CASCADE,
  CONSTRAINT "exam_reports_conclusion_template_id_fkey" FOREIGN KEY ("conclusion_template_id")
    REFERENCES "conclusion_templates" ("id") ON DELETE SET NULL,
  CONSTRAINT "exam_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id")
    REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX "exam_reports_patient_id_idx" ON "exam_reports" ("patient_id");
CREATE INDEX "exam_reports_exam_type_idx" ON "exam_reports" ("exam_type");
CREATE INDEX "exam_reports_created_at_idx" ON "exam_reports" ("created_at");

CREATE TABLE "exam_report_sections" (
  "id" SERIAL NOT NULL,
  "exam_report_id" INTEGER NOT NULL,
  "section_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "exam_report_sections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_report_sections_exam_report_id_fkey" FOREIGN KEY ("exam_report_id")
    REFERENCES "exam_reports" ("id") ON DELETE CASCADE
);

CREATE INDEX "exam_report_sections_exam_report_id_idx" ON "exam_report_sections" ("exam_report_id");

CREATE TABLE "exam_report_reactions" (
  "id" SERIAL NOT NULL,
  "section_id" INTEGER NOT NULL,
  "allergen_id" TEXT NOT NULL,
  "reaction" "SkinReaction" NOT NULL,
  "papule_mm" DECIMAL(5, 2),
  "notes" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "exam_report_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_report_reactions_section_id_fkey" FOREIGN KEY ("section_id")
    REFERENCES "exam_report_sections" ("id") ON DELETE CASCADE,
  CONSTRAINT "exam_report_reactions_allergen_id_fkey" FOREIGN KEY ("allergen_id")
    REFERENCES "clinical_allergens" ("id") ON DELETE RESTRICT
);

CREATE INDEX "exam_report_reactions_section_id_idx" ON "exam_report_reactions" ("section_id");
CREATE INDEX "exam_report_reactions_allergen_id_idx" ON "exam_report_reactions" ("allergen_id");
