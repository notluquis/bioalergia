-- Enforce "1 account number -> 1 counterpart" at DB level.
-- 1) Canonicalize account_number with the same normalization used in services:
--    - trim
--    - remove non-alphanumeric chars
--    - uppercase
--    - strip leading zeros (keeping "0" when all zeros)
-- 2) Remove duplicates, keeping the lowest id per canonical account number.
-- 3) Add unique index.

WITH normalized AS (
  SELECT
    id,
    UPPER(REGEXP_REPLACE(BTRIM(account_number), '[^0-9A-Za-z]+', '', 'g')) AS compact
  FROM counterpart_accounts
),
canonical AS (
  SELECT
    id,
    CASE
      WHEN compact = '' THEN '0'
      ELSE COALESCE(NULLIF(REGEXP_REPLACE(compact, '^0+', ''), ''), '0')
    END AS canonical_account_number
  FROM normalized
)
UPDATE counterpart_accounts AS ca
SET account_number = c.canonical_account_number
FROM canonical AS c
WHERE ca.id = c.id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY account_number ORDER BY id ASC) AS rn
  FROM counterpart_accounts
)
DELETE FROM counterpart_accounts
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "counterpart_accounts_account_number_key"
  ON "counterpart_accounts"("account_number");
