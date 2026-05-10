-- AlterTable
ALTER TABLE "wa_saved_flows" ADD COLUMN     "account_id" INTEGER,
ADD COLUMN     "meta_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "meta_health" TEXT,
ADD COLUMN     "meta_status" TEXT,
ADD COLUMN     "meta_synced_at" TIMESTAMP(3);
