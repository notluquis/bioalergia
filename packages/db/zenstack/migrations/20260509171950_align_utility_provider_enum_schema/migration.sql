-- DropForeignKey
ALTER TABLE "clinical_series" DROP CONSTRAINT "clinical_series_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "expense_transactions" DROP CONSTRAINT "expense_transactions_expense_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_service_id_fkey";

-- DropIndex
DROP INDEX "personal"."utility_accounts_is_active_idx";

-- DropIndex
DROP INDEX "personal"."utility_accounts_provider_idx";

-- DropIndex
DROP INDEX "addresses_chilexpress_address_id_idx";

-- DropIndex
DROP INDEX "clinical_document_imports_onedrive_quick_xor_hash_idx";

-- DropIndex
DROP INDEX "clinical_skin_test_imports_onedrive_quick_xor_hash_idx";

-- DropIndex
DROP INDEX "clinical_xlsx_files_onedrive_quick_xor_hash_idx";

-- DropIndex
DROP INDEX "expense_services_is_active_idx";

-- DropIndex
DROP INDEX "expense_services_scope_idx";

-- DropIndex
DROP INDEX "expenses_status_idx";

-- DropIndex
DROP INDEX "shipments_barcode_idx";

-- AlterTable
ALTER TABLE "addresses" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "expense_services" ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "expense_transactions" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "expenses" ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "clinical_series" ADD CONSTRAINT "clinical_series_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "expense_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_transactions" ADD CONSTRAINT "expense_transactions_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "clinical_xlsx_files_account_drive_item_key" RENAME TO "clinical_xlsx_files_onedrive_account_id_onedrive_drive_id_o_key";
