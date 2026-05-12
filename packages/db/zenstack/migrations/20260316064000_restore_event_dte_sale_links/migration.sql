-- Restore table lost during rebaseline: event_dte_sale_links
-- This migration is additive and data-safe.

CREATE TABLE IF NOT EXISTS public.event_dte_sale_links (
  id BIGSERIAL PRIMARY KEY,
  event_id INT NOT NULL,
  dte_sale_detail_id TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  matched_by VARCHAR(30) NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL,
  matched_rut VARCHAR(20),
  matched_name TEXT,
  evidence JSONB,
  created_by INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT event_dte_sale_links_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT event_dte_sale_links_dte_sale_detail_id_fkey
    FOREIGN KEY (dte_sale_detail_id) REFERENCES public.dte_sale_details(id) ON DELETE CASCADE,
  CONSTRAINT event_dte_sale_links_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT event_dte_sale_links_status_check
    CHECK (status IN ('CONFIRMED', 'MANUAL', 'REJECTED')),
  CONSTRAINT event_dte_sale_links_match_by_check
    CHECK (matched_by IN ('rut', 'name_exact', 'name_fuzzy', 'mixed', 'manual')),
  CONSTRAINT event_dte_sale_links_confidence_check
    CHECK (confidence_score >= 0 AND confidence_score <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS event_dte_sale_links_event_id_key
  ON public.event_dte_sale_links(event_id);

CREATE INDEX IF NOT EXISTS event_dte_sale_links_dte_sale_detail_id_idx
  ON public.event_dte_sale_links(dte_sale_detail_id);

CREATE INDEX IF NOT EXISTS event_dte_sale_links_created_at_idx
  ON public.event_dte_sale_links(created_at DESC);
