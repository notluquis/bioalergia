ALTER TABLE "clinical_skin_test_imports"
  ADD COLUMN "result_hash" TEXT,
  ADD COLUMN "duplicate_of_import_id" TEXT;

ALTER TABLE "clinical_skin_tests"
  ADD COLUMN "clinical_note" TEXT,
  ADD COLUMN "physician_name" TEXT,
  ADD COLUMN "physician_specialty" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "non_conclusive_due_to_hyperreactivity" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "result_hash" TEXT;

CREATE INDEX "clinical_skin_test_imports_result_hash_idx" ON "clinical_skin_test_imports"("result_hash");
CREATE INDEX "clinical_skin_test_imports_duplicate_of_import_id_idx" ON "clinical_skin_test_imports"("duplicate_of_import_id");
CREATE INDEX "clinical_skin_tests_result_hash_idx" ON "clinical_skin_tests"("result_hash");

ALTER TABLE "clinical_skin_test_imports"
  ADD CONSTRAINT "clinical_skin_test_imports_duplicate_of_import_id_fkey"
  FOREIGN KEY ("duplicate_of_import_id") REFERENCES "clinical_skin_test_imports"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
