-- Medication catalog (searchable backing for prescription "Medicamento" autocomplete).
-- Idempotent + additive: safe to run via `migrate deploy` against prod.

CREATE TABLE IF NOT EXISTS "public"."medications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generic_name" TEXT,
    "active_ingredient" TEXT,
    "laboratory" TEXT,
    "form" TEXT,
    "presentation" TEXT,
    "source" TEXT NOT NULL DEFAULT 'curated',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "medications_name_idx" ON "public"."medications"("name");

CREATE INDEX IF NOT EXISTS "medications_generic_name_idx" ON "public"."medications"("generic_name");
