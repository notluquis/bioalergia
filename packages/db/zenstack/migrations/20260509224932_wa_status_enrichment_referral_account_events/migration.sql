-- CreateEnum
CREATE TYPE "WaAccountEventKind" AS ENUM ('ACCOUNT_ALERT', 'ACCOUNT_REVIEW', 'ACCOUNT_SETTINGS', 'ACCOUNT_UPDATE', 'BUSINESS_CAPABILITY', 'BUSINESS_STATUS', 'SECURITY', 'PARTNER_SOLUTIONS', 'PAYMENT_CONFIG', 'USER_PREFERENCES', 'PHONE_QUALITY', 'PHONE_NAME', 'TEMPLATE_STATUS', 'TEMPLATE_QUALITY', 'TEMPLATE_CATEGORY', 'AUTOMATIC', 'TRACKING', 'OTHER');

-- AlterTable
ALTER TABLE "wa_contacts" ADD COLUMN     "marketing_opt_in" BOOLEAN,
ADD COLUMN     "marketing_opt_in_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "wa_messages" ADD COLUMN     "biz_callback_data" TEXT,
ADD COLUMN     "conversation_origin" TEXT,
ADD COLUMN     "conversation_window_id" TEXT,
ADD COLUMN     "pricing_billable" BOOLEAN,
ADD COLUMN     "pricing_category" TEXT,
ADD COLUMN     "pricing_model" TEXT,
ADD COLUMN     "referral_body_text" TEXT,
ADD COLUMN     "referral_ctwa_clid" TEXT,
ADD COLUMN     "referral_headline" TEXT,
ADD COLUMN     "referral_media_type" TEXT,
ADD COLUMN     "referral_media_url" TEXT,
ADD COLUMN     "referral_source_id" TEXT,
ADD COLUMN     "referral_source_type" TEXT,
ADD COLUMN     "referral_source_url" TEXT;

-- CreateTable
CREATE TABLE "wa_account_events" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER,
    "phone_number_id" INTEGER,
    "kind" "WaAccountEventKind" NOT NULL,
    "field" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_user_id" INTEGER,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_account_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wa_account_events_acknowledged_received_at_idx" ON "wa_account_events"("acknowledged", "received_at");

-- CreateIndex
CREATE INDEX "wa_account_events_account_id_idx" ON "wa_account_events"("account_id");

-- CreateIndex
CREATE INDEX "wa_account_events_severity_idx" ON "wa_account_events"("severity");

-- AddForeignKey
ALTER TABLE "wa_account_events" ADD CONSTRAINT "wa_account_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wa_business_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_account_events" ADD CONSTRAINT "wa_account_events_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "wa_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
