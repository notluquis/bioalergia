-- CreateEnum
CREATE TYPE "AbandonmentContactOutcome" AS ENUM ('WILL_RETURN', 'DECLINED', 'UNREACHABLE', 'RESCHEDULED', 'OTHER');

-- CreateTable
CREATE TABLE "abandonment_contacts" (
    "id" BIGSERIAL NOT NULL,
    "series_id" INTEGER NOT NULL,
    "outcome" "AbandonmentContactOutcome" NOT NULL,
    "notes" TEXT,
    "contacted_by_id" INTEGER NOT NULL,
    "contacted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abandonment_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "abandonment_contacts_series_id_idx" ON "abandonment_contacts"("series_id");

-- AddForeignKey
ALTER TABLE "abandonment_contacts" ADD CONSTRAINT "abandonment_contacts_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "clinical_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abandonment_contacts" ADD CONSTRAINT "abandonment_contacts_contacted_by_id_fkey" FOREIGN KEY ("contacted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
