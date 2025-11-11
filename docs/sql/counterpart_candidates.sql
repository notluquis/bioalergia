-- Counterpart discovery report
-- ---------------------------------------------
-- Use the withdrawal identification_number as the canonical RUT key.
-- This statement lists every unique identification_number detected in
-- Mercado Pago withdrawals alongside the linked mp_counterparts entry
-- (if any).  Run it in the Bioalergia database to review which RUTs
-- still need to be registered.

WITH normalized_withdrawals AS (
  SELECT
    -- Normalize the RUT / identification_number so it matches mp_counterparts.rut
    UPPER(REPLACE(REPLACE(REPLACE(identification_number, '.', ''), '-', ''), ' ', '')) AS rut_key,
    MAX(identification_number) AS identification_display,
    MAX(bank_account_holder) AS holder_name,
    MAX(bank_name) AS bank_name,
    MAX(bank_account_type) AS bank_account_type,
    MAX(bank_account_number) AS bank_account_number,
    COUNT(DISTINCT withdraw_id) AS total_withdrawals,
    COUNT(1) AS total_movements,
    MAX(date_created) AS last_payout_at
  FROM mp_withdrawals
  WHERE identification_number IS NOT NULL
  GROUP BY rut_key
)
SELECT
  nw.identification_display AS rut_detected,
  nw.holder_name,
  nw.bank_name,
  nw.bank_account_type,
  nw.bank_account_number,
  nw.total_withdrawals,
  nw.total_movements,
  nw.last_payout_at,
  c.id AS counterpart_id,
  c.name AS counterpart_name,
  c.category AS counterpart_category,
  c.person_type AS counterpart_person_type,
  c.updated_at AS counterpart_updated_at
FROM normalized_withdrawals nw
LEFT JOIN mp_counterparts c
  ON REPLACE(REPLACE(REPLACE(UPPER(c.rut), '.', ''), '-', ''), ' ', '') = nw.rut_key
ORDER BY
  (c.id IS NULL) DESC,
  nw.last_payout_at DESC;

-- To auto-create missing counterparts based on the detection above, you can
-- wrap the SELECT in an INSERT.  Example (review before running in production):
--
INSERT INTO mp_counterparts (rut, name, person_type, category)
SELECT DISTINCT
nw.identification_display AS rut,
COALESCE(nw.holder_name, nw.identification_display) AS name
-- 'PERSON' AS person_type,
--   'SUPPLIER' AS category
FROM normalized_withdrawals nw
LEFT JOIN mp_counterparts c
ON REPLACE(REPLACE(REPLACE(UPPER(c.rut), '.', ''), '-', ''), ' ', '') = nw.rut_key
WHERE c.id IS NULL;
--
-- After inserting, call assignAccountsToCounterpartByRut(counterpart_id, rut)
-- (via the server route POST /api/counterparts/:id/attach-rut) to pull every
-- mp_withdrawals account_identifier that shares the same identification_number.

/* ---------------------------------------------------------------------------
   Backfill identification_number on mp_counterpart_accounts
   ---------------------------------------------------------------------------
   Sync legacy accounts so their metadata includes the identification_number
   associated with each Mercado Pago withdrawal. This ties the account
   directly to the RUT used by mp_withdrawals.

   Mapping:
     mp_withdrawals.bank_account_number  -> mp_counterpart_accounts.account_identifier
--------------------------------------------------------------------------- */
UPDATE mp_counterpart_accounts cca
JOIN mp_withdrawals mw
  ON mw.bank_account_number IS NOT NULL
 AND mw.bank_account_number = cca.account_identifier
SET cca.metadata = JSON_SET(
      COALESCE(cca.metadata, JSON_OBJECT()),
      '$.identificationNumber',
      mw.identification_number
    )
WHERE mw.identification_number IS NOT NULL;
