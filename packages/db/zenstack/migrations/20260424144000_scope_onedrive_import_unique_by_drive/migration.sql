-- DropIndex
DROP INDEX IF EXISTS "clinical_skin_test_imports_onedrive_account_id_onedrive_item_id";
DROP INDEX IF EXISTS "clinical_skin_test_imports_onedrive_account_id_onedrive_item_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "clinical_skin_test_imports_account_drive_item_key" ON "clinical_skin_test_imports"("onedrive_account_id", "onedrive_drive_id", "onedrive_item_id");
