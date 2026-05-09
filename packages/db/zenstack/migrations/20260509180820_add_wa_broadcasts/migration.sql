-- CreateEnum
CREATE TYPE "WaBroadcastStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENDING', 'DONE', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "WaBroadcastRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "wa_broadcasts" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "phone_number_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "template_language" TEXT NOT NULL,
    "status" "WaBroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "rate_limit_per_second" INTEGER NOT NULL DEFAULT 5,
    "created_by_user_id" INTEGER NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_broadcast_recipients" (
    "id" SERIAL NOT NULL,
    "broadcast_id" INTEGER NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "status" "WaBroadcastRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sent_message_id" INTEGER,
    "meta_message_id" TEXT,
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wa_broadcasts_status_idx" ON "wa_broadcasts"("status");

-- CreateIndex
CREATE INDEX "wa_broadcasts_scheduled_at_idx" ON "wa_broadcasts"("scheduled_at");

-- CreateIndex
CREATE INDEX "wa_broadcast_recipients_broadcast_id_status_idx" ON "wa_broadcast_recipients"("broadcast_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wa_broadcast_recipients_broadcast_id_phone_e164_key" ON "wa_broadcast_recipients"("broadcast_id", "phone_e164");

-- AddForeignKey
ALTER TABLE "wa_broadcasts" ADD CONSTRAINT "wa_broadcasts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wa_business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_broadcasts" ADD CONSTRAINT "wa_broadcasts_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "wa_phone_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_broadcast_recipients" ADD CONSTRAINT "wa_broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "wa_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
