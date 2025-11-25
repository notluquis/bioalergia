-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER,
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
CREATE TABLE "daily_production_balances" (
    "id" SERIAL NOT NULL,
    "balance_date" DATE NOT NULL,
    "ingreso_tarjetas" INTEGER NOT NULL DEFAULT 0,
    "ingreso_transferencias" INTEGER NOT NULL DEFAULT 0,
    "ingreso_efectivo" INTEGER NOT NULL DEFAULT 0,
    "gastos_diarios" INTEGER NOT NULL DEFAULT 0,
    "otros_abonos" INTEGER NOT NULL DEFAULT 0,
    "consultas_count" INTEGER NOT NULL DEFAULT 0,
    "controles_count" INTEGER NOT NULL DEFAULT 0,
    "tests_count" INTEGER NOT NULL DEFAULT 0,
    "vacunas_count" INTEGER NOT NULL DEFAULT 0,
    "licencias_count" INTEGER NOT NULL DEFAULT 0,
    "roxair_count" INTEGER NOT NULL DEFAULT 0,
    "comentarios" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "change_reason" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_production_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_name_key" ON "inventory_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "daily_production_balances_balance_date_key" ON "daily_production_balances"("balance_date");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_balances" ADD CONSTRAINT "daily_production_balances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
