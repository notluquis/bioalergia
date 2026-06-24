-- AlterTable: logos administrables para los PDFs (R2/CDN, fallback local)
ALTER TABLE "clinic_settings" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "clinic_settings" ADD COLUMN "secondary_logo_url" TEXT;
