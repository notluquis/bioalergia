ALTER TABLE "personal"."utility_accounts"
  ADD COLUMN "scope" "ExpenseScope" NOT NULL DEFAULT 'PERSONAL';

CREATE INDEX "utility_accounts_scope_idx" ON "personal"."utility_accounts"("scope");
