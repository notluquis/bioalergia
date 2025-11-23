-- AlterTable
ALTER TABLE "services" ALTER COLUMN "start_date" SET DEFAULT '1970-01-01';

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_allergy_types" (
    "id" SERIAL NOT NULL,
    "parent_id" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_allergy_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER,
    "allergy_type_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity_change" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_providers" (
    "id" SERIAL NOT NULL,
    "rut" VARCHAR(20) NOT NULL,
    "name" TEXT NOT NULL,
    "contact_info" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item_providers" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "current_price" DECIMAL(10,2),
    "last_stock_check" TIMESTAMP(3),
    "last_price_check" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_item_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_provider_checks" (
    "id" SERIAL NOT NULL,
    "item_provider_id" INTEGER NOT NULL,
    "check_type" TEXT NOT NULL,
    "quantity" INTEGER,
    "price" DECIMAL(10,2),
    "notes" TEXT,
    "transaction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_provider_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_accounts" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "account_identifier" TEXT NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "inventory_allergy_types" ADD CONSTRAINT "inventory_allergy_types_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "inventory_allergy_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_allergy_type_id_fkey" FOREIGN KEY ("allergy_type_id") REFERENCES "inventory_allergy_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item_providers" ADD CONSTRAINT "inventory_item_providers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item_providers" ADD CONSTRAINT "inventory_item_providers_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "inventory_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_provider_checks" ADD CONSTRAINT "inventory_provider_checks_item_provider_id_fkey" FOREIGN KEY ("item_provider_id") REFERENCES "inventory_item_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_provider_checks" ADD CONSTRAINT "inventory_provider_checks_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "mp_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "inventory_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
