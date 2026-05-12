-- Extend auto-category rules with payment-method and gross/net matching
ALTER TABLE "financial_auto_category_rules"
  ADD COLUMN "amounts_exact" DECIMAL(19,4)[] NOT NULL DEFAULT '{}',
  ADD COLUMN "payment_methods" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "match_amount_on" TEXT NOT NULL DEFAULT 'net';
