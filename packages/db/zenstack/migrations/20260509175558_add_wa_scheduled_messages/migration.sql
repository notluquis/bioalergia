-- CreateEnum
CREATE TYPE "WaScheduledStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "wa_scheduled_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "phone_number_id" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "WaScheduledStatus" NOT NULL DEFAULT 'PENDING',
    "type" "WaMessageType" NOT NULL,
    "body" TEXT,
    "template_name" TEXT,
    "template_language" TEXT,
    "template_vars" JSONB NOT NULL DEFAULT '[]',
    "context_meta_message_id" TEXT,
    "created_by_user_id" INTEGER NOT NULL,
    "sent_message_id" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_scheduled_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wa_scheduled_messages_status_scheduled_at_idx" ON "wa_scheduled_messages"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "wa_scheduled_messages_conversation_id_idx" ON "wa_scheduled_messages"("conversation_id");

-- AddForeignKey
ALTER TABLE "wa_scheduled_messages" ADD CONSTRAINT "wa_scheduled_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "wa_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_scheduled_messages" ADD CONSTRAINT "wa_scheduled_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "wa_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_scheduled_messages" ADD CONSTRAINT "wa_scheduled_messages_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "wa_phone_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
