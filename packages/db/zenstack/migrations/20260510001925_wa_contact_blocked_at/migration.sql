-- AlterTable
ALTER TABLE "wa_contacts" ADD COLUMN     "blocked_at" TIMESTAMP(3),
ADD COLUMN     "blocked_by_user_id" INTEGER;
