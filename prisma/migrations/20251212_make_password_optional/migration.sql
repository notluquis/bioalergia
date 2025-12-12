-- AlterTable: Make password_hash optional to support passkey-only users
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
