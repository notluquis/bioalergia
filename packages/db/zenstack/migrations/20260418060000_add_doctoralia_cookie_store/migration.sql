-- CreateTable
CREATE TABLE "doctoralia_cookie_store" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'default',
    "cookies_json" JSONB NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_user_id" INTEGER,

    CONSTRAINT "doctoralia_cookie_store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctoralia_cookie_store_label_key" ON "doctoralia_cookie_store"("label");

-- AddForeignKey
ALTER TABLE "doctoralia_cookie_store" ADD CONSTRAINT "doctoralia_cookie_store_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
