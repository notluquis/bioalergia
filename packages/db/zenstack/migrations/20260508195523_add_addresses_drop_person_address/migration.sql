-- AlterTable: drop legacy free-text address column
ALTER TABLE "people" DROP COLUMN IF EXISTS "address";

-- CreateTable: structured addresses (1:N per person)
CREATE TABLE "addresses" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Principal',
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplement" TEXT,
    "reference" TEXT,
    "postal_code" TEXT,
    "comuna" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "coverage_code" TEXT,
    "region_code" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'CL',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "addresses_person_id_idx" ON "addresses"("person_id");
CREATE INDEX "addresses_person_id_is_primary_idx" ON "addresses"("person_id", "is_primary");

ALTER TABLE "addresses"
  ADD CONSTRAINT "addresses_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "people"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
