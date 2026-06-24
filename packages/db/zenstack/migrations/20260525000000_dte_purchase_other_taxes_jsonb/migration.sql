-- DTEPurchaseDetail: full-fidelity multi-tax storage (additive, idempotent).
-- SII "Otros Impuestos" can carry multiple {codigo,tasa,monto} per document;
-- Haulmer dumps them as a JSON array in the Valor column. Scalar otherTax*
-- columns keep mirroring the first entry for backward compat.
ALTER TABLE "public"."dte_purchase_details" ADD COLUMN IF NOT EXISTS "other_taxes" JSONB;
