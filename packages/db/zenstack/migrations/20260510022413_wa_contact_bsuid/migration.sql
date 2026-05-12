-- Meta 2026: BSUID forward-compat column on wa_contacts (already applied
-- directly via psql + recorded with prisma migrate resolve)
ALTER TABLE "wa_contacts" ADD COLUMN IF NOT EXISTS "bsuid" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "wa_contacts_bsuid_key" ON "wa_contacts"("bsuid");
