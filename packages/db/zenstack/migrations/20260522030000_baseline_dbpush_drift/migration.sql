-- AlterTable
ALTER TABLE "public"."addresses" ADD COLUMN     "user_id" INTEGER;

-- CreateTable
CREATE TABLE "public"."magic_link_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_reviews" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_email" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "magic_link_tokens_expires_at_idx" ON "public"."magic_link_tokens"("expires_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_token_hash_key" ON "public"."magic_link_tokens"("token_hash" ASC);

-- CreateIndex
CREATE INDEX "magic_link_tokens_user_id_consumed_at_idx" ON "public"."magic_link_tokens"("user_id" ASC, "consumed_at" ASC);

-- CreateIndex
CREATE INDEX "product_reviews_product_id_status_idx" ON "public"."product_reviews"("product_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "product_reviews_status_idx" ON "public"."product_reviews"("status" ASC);

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "public"."addresses"("user_id" ASC);

-- CreateIndex
CREATE INDEX "products_brand_trgm_idx" ON "public"."products" USING GIN ("brand" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_name_trgm_idx" ON "public"."products" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_sku_trgm_idx" ON "public"."products" USING GIN ("sku" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

