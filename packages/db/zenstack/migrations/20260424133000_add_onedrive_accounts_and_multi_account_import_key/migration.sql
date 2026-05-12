-- CreateTable
CREATE TABLE "onedrive_accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "folder_path" TEXT,
    "delta_link" TEXT,
    "last_delta_sync_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onedrive_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onedrive_watch_channels" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onedrive_watch_channels_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "clinical_skin_test_imports" ADD COLUMN "onedrive_account_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "onedrive_accounts_account_id_key" ON "onedrive_accounts"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "onedrive_watch_channels_subscription_id_key" ON "onedrive_watch_channels"("subscription_id");

-- CreateIndex
CREATE INDEX "onedrive_watch_channels_account_id_idx" ON "onedrive_watch_channels"("account_id");

-- CreateIndex
DROP INDEX "clinical_skin_test_imports_onedrive_item_id_key";
CREATE INDEX "clinical_skin_test_imports_onedrive_account_id_idx" ON "clinical_skin_test_imports"("onedrive_account_id");
CREATE UNIQUE INDEX "clinical_skin_test_imports_onedrive_account_id_onedrive_item_id_key" ON "clinical_skin_test_imports"("onedrive_account_id", "onedrive_item_id");

-- AddForeignKey
ALTER TABLE "onedrive_watch_channels" ADD CONSTRAINT "onedrive_watch_channels_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "onedrive_accounts"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_skin_test_imports" ADD CONSTRAINT "clinical_skin_test_imports_onedrive_account_id_fkey" FOREIGN KEY ("onedrive_account_id") REFERENCES "onedrive_accounts"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;
