-- CreateTable
CREATE TABLE "wa_saved_locations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_saved_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_saved_interactive_lists" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "header_text" TEXT,
    "body_text" TEXT NOT NULL,
    "footer_text" TEXT,
    "button_text" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_saved_interactive_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_saved_flows" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "flow_id" TEXT NOT NULL,
    "flow_token" TEXT,
    "initial_screen" TEXT,
    "default_body" TEXT NOT NULL,
    "default_header" TEXT,
    "default_footer" TEXT,
    "default_cta" TEXT NOT NULL DEFAULT 'Iniciar',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_saved_flows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wa_saved_locations_archived_idx" ON "wa_saved_locations"("archived");

-- CreateIndex
CREATE INDEX "wa_saved_interactive_lists_archived_idx" ON "wa_saved_interactive_lists"("archived");

-- CreateIndex
CREATE INDEX "wa_saved_flows_archived_idx" ON "wa_saved_flows"("archived");

-- CreateIndex
CREATE UNIQUE INDEX "wa_saved_flows_flow_id_key" ON "wa_saved_flows"("flow_id");
