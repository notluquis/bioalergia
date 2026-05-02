-- Migrate any EMPRESA rows to BIOALERGIA before removing the enum value
UPDATE expenses SET scope = 'BIOALERGIA' WHERE scope = 'EMPRESA';
UPDATE expense_services SET scope = 'BIOALERGIA' WHERE scope = 'EMPRESA';
UPDATE "personal".utility_accounts SET scope = 'BIOALERGIA' WHERE scope = 'EMPRESA';

-- Drop column defaults that reference the old enum type before recreating it
ALTER TABLE "personal".utility_accounts ALTER COLUMN scope DROP DEFAULT;

-- Postgres doesn't support DROP VALUE on enums, so we recreate it
ALTER TYPE "ExpenseScope" RENAME TO "ExpenseScope_old";
CREATE TYPE "ExpenseScope" AS ENUM ('BIOALERGIA', 'PERSONAL');

ALTER TABLE expenses
  ALTER COLUMN scope TYPE "ExpenseScope" USING scope::text::"ExpenseScope";
ALTER TABLE expense_services
  ALTER COLUMN scope TYPE "ExpenseScope" USING scope::text::"ExpenseScope";
ALTER TABLE "personal".utility_accounts
  ALTER COLUMN scope TYPE "ExpenseScope" USING scope::text::"ExpenseScope";

-- Re-add default using new type
ALTER TABLE "personal".utility_accounts ALTER COLUMN scope SET DEFAULT 'PERSONAL';

DROP TYPE "ExpenseScope_old";
