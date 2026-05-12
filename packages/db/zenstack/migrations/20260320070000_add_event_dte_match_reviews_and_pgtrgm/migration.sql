-- Event ↔ DTE matching V3 support:
-- - feedback/audit trail for human decisions
-- - pg_trgm index for candidate retrieval by fuzzy client name
-- - amount/date retrieval index for same-day blocking

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.event_dte_match_reviews (
  id bigserial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  action varchar(20) NOT NULL,
  hypothesis_kind varchar(20),
  dte_sale_detail_ids jsonb NOT NULL,
  hypothesis jsonb,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_dte_match_reviews_event_id_idx
  ON public.event_dte_match_reviews(event_id);

CREATE INDEX IF NOT EXISTS event_dte_match_reviews_action_idx
  ON public.event_dte_match_reviews(action);

CREATE INDEX IF NOT EXISTS event_dte_match_reviews_created_at_idx
  ON public.event_dte_match_reviews(created_at DESC);

CREATE INDEX IF NOT EXISTS dte_sale_details_document_date_total_amount_idx
  ON public.dte_sale_details(document_date, total_amount);

CREATE INDEX IF NOT EXISTS dte_sale_details_client_name_trgm_idx
  ON public.dte_sale_details
  USING gin (lower(client_name) gin_trgm_ops);
