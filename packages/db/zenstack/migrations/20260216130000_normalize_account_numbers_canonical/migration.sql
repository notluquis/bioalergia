-- Normalize account identifiers to canonical format:
-- 1) trim spaces
-- 2) remove inner whitespace
-- 3) uppercase
-- 4) strip leading zeros (keeping "0" when the value is only zeros)

WITH normalized_counterpart_accounts AS (
  SELECT
    id,
    UPPER(REGEXP_REPLACE(BTRIM(account_number), '\\s+', '', 'g')) AS compact
  FROM counterpart_accounts
)
UPDATE counterpart_accounts AS ca
SET account_number = CASE
  WHEN nca.compact = '' THEN '0'
  ELSE COALESCE(NULLIF(REGEXP_REPLACE(nca.compact, '^0+', ''), ''), '0')
END
FROM normalized_counterpart_accounts AS nca
WHERE ca.id = nca.id;

WITH normalized_release_transactions AS (
  SELECT
    id,
    UPPER(REGEXP_REPLACE(BTRIM(payout_bank_account_number), '\\s+', '', 'g')) AS compact
  FROM release_transactions
  WHERE payout_bank_account_number IS NOT NULL
)
UPDATE release_transactions AS rt
SET payout_bank_account_number = CASE
  WHEN nrt.compact = '' THEN NULL
  ELSE COALESCE(NULLIF(REGEXP_REPLACE(nrt.compact, '^0+', ''), ''), '0')
END
FROM normalized_release_transactions AS nrt
WHERE rt.id = nrt.id;

WITH normalized_withdraw_transactions AS (
  SELECT
    id,
    UPPER(REGEXP_REPLACE(BTRIM(bank_account_number), '\\s+', '', 'g')) AS compact
  FROM withdraw_transactions
  WHERE bank_account_number IS NOT NULL
)
UPDATE withdraw_transactions AS wt
SET bank_account_number = CASE
  WHEN nwt.compact = '' THEN NULL
  ELSE COALESCE(NULLIF(REGEXP_REPLACE(nwt.compact, '^0+', ''), ''), '0')
END
FROM normalized_withdraw_transactions AS nwt
WHERE wt.id = nwt.id;
