-- Extend combined view with withdrawals
-- ZenStack migration

DROP VIEW IF EXISTS public.settlement_release_transactions;

CREATE VIEW public.settlement_release_transactions AS
SELECT
  COALESCE(s.source_id, r.source_id, w.withdraw_id) AS row_id,
  COALESCE(s.source_id, r.source_id, w.withdraw_id) AS source_id,
  CASE
    WHEN s.source_id IS NOT NULL AND r.source_id IS NOT NULL AND w.withdraw_id IS NOT NULL THEN 'all'
    WHEN s.source_id IS NOT NULL AND r.source_id IS NOT NULL THEN 'both'
    WHEN s.source_id IS NOT NULL AND w.withdraw_id IS NOT NULL THEN 'settlement_withdraw'
    WHEN r.source_id IS NOT NULL AND w.withdraw_id IS NOT NULL THEN 'release_withdraw'
    WHEN s.source_id IS NOT NULL THEN 'settlement'
    WHEN r.source_id IS NOT NULL THEN 'release'
    ELSE 'withdraw'
  END AS origin,
  COALESCE(s.transaction_date, r.date, w.date_created) AS effective_date,
  s.external_reference AS settlement_external_reference,
  s.payment_method_type AS settlement_payment_method_type,
  s.payment_method AS settlement_payment_method,
  s.transaction_type AS settlement_transaction_type,
  s.transaction_amount AS settlement_transaction_amount,
  s.fee_amount AS settlement_fee_amount,
  s.settlement_net_amount AS settlement_settlement_net_amount,
  s.real_amount AS settlement_real_amount,
  s.financing_fee_amount AS settlement_financing_fee_amount,
  s.installments AS settlement_installments,
  s.business_unit AS settlement_business_unit,
  s.sub_unit AS settlement_sub_unit,
  s.pay_bank_transfer_id AS settlement_pay_bank_transfer_id,
  s.metadata AS settlement_metadata,
  r.external_reference AS release_external_reference,
  r.description AS release_description,
  r.net_debit_amount AS release_net_debit_amount,
  r.gross_amount AS release_gross_amount,
  r.balance_amount AS release_balance_amount,
  r.payout_bank_account_number AS release_payout_bank_account_number,
  r.business_unit AS release_business_unit,
  r.issuer_name AS release_issuer_name,
  r.metadata AS release_metadata,
  w.withdraw_id AS withdraw_id,
  w.date_created AS withdraw_date_created,
  w.status AS withdraw_status,
  w.status_detail AS withdraw_status_detail,
  w.amount AS withdraw_amount,
  w.fee AS withdraw_fee,
  w.activity_url AS withdraw_activity_url,
  w.payout_desc AS withdraw_payout_desc,
  w.bank_account_holder AS withdraw_bank_account_holder,
  w.identification_type AS withdraw_identification_type,
  w.identification_number AS withdraw_identification_number,
  w.bank_id AS withdraw_bank_id,
  w.bank_name AS withdraw_bank_name,
  w.bank_branch AS withdraw_bank_branch,
  w.bank_account_type AS withdraw_bank_account_type,
  w.bank_account_number AS withdraw_bank_account_number
FROM public.settlement_transactions s
FULL OUTER JOIN public.release_transactions r
  ON s.source_id = r.source_id
FULL OUTER JOIN public.withdraw_transactions w
  ON COALESCE(s.source_id, r.source_id) = w.withdraw_id
WHERE s.transaction_type IS DISTINCT FROM 'CASHBACK' OR s.transaction_type IS NULL;
