-- CreateEnum
CREATE TYPE "personal"."UtilityProvider" AS ENUM ('ESSBIO', 'CGE', 'OTHER');

-- CreateTable
CREATE TABLE "personal"."utility_accounts" (
    "id" SERIAL NOT NULL,
    "provider" "personal"."UtilityProvider" NOT NULL,
    "service_number" TEXT NOT NULL,
    "label" TEXT,
    "client_name" TEXT,
    "address" TEXT,
    "last_fetched_at" TIMESTAMP(3),
    "last_amount" DECIMAL(15,2),
    "last_previous_amount" DECIMAL(15,2),
    "expense_service_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utility_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utility_accounts_service_number_key" ON "personal"."utility_accounts"("service_number");

-- CreateIndex
CREATE INDEX "utility_accounts_provider_idx" ON "personal"."utility_accounts"("provider");

-- CreateIndex
CREATE INDEX "utility_accounts_is_active_idx" ON "personal"."utility_accounts"("is_active");
