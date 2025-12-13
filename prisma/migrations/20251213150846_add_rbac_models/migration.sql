/*
  Warnings:

  - You are about to drop the column `consultas_count` on the `daily_production_balances` table. All the data in the column will be lost.
  - You are about to drop the column `controles_count` on the `daily_production_balances` table. All the data in the column will be lost.
  - You are about to drop the column `licencias_count` on the `daily_production_balances` table. All the data in the column will be lost.
  - You are about to drop the column `roxair_count` on the `daily_production_balances` table. All the data in the column will be lost.
  - You are about to drop the column `tests_count` on the `daily_production_balances` table. All the data in the column will be lost.
  - You are about to drop the column `vacunas_count` on the `daily_production_balances` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "daily_production_balances" DROP COLUMN "consultas_count",
DROP COLUMN "controles_count",
DROP COLUMN "licencias_count",
DROP COLUMN "roxair_count",
DROP COLUMN "tests_count",
DROP COLUMN "vacunas_count",
ADD COLUMN     "consultas_monto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "controles_monto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "licencias_monto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roxair_monto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tests_monto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vacunas_monto" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "overtime_rate" DECIMAL(10,2),
ADD COLUMN     "retention_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.145;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfa_enforced" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "conditions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "user_permission_versions" (
    "userId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_versions_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "daily_balances" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "note" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_watch_channels" (
    "id" SERIAL NOT NULL,
    "calendar_id" INTEGER NOT NULL,
    "channel_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_watch_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_requests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "supply_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_supplies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "common_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_subject_key" ON "permissions"("action", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "daily_balances_date_key" ON "daily_balances"("date");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_watch_channels_channel_id_key" ON "calendar_watch_channels"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "common_supplies_name_brand_model_key" ON "common_supplies"("name", "brand", "model");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_versions" ADD CONSTRAINT "user_permission_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_watch_channels" ADD CONSTRAINT "calendar_watch_channels_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
