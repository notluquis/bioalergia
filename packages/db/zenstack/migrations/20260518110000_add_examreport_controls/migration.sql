-- Persist the histamine + saline control mm values on ExamReport so
-- reopening an old report can round-trip them without re-deriving from
-- the XLSX skin-test snapshot. Both nullable; existing rows render `—`
-- as before. Wizard writes them on create going forward.
ALTER TABLE "public"."exam_reports" ADD COLUMN "histamine_mm" DECIMAL(5, 2);
ALTER TABLE "public"."exam_reports" ADD COLUMN "saline_mm" DECIMAL(5, 2);
