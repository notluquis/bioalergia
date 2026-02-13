-- Remove legacy MercadoPago unified transactions table.
-- Runtime now reads from release_transactions + settlement_transactions.
DROP TABLE IF EXISTS public.transactions;
