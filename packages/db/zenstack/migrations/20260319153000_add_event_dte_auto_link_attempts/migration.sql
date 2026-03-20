CREATE TABLE IF NOT EXISTS public.event_dte_auto_link_attempts (
  id BIGSERIAL PRIMARY KEY,
  event_id INT NOT NULL,
  candidate_dte_sale_detail_id TEXT,
  status VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  confidence_score NUMERIC(5,2),
  created_by INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT event_dte_auto_link_attempts_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT event_dte_auto_link_attempts_candidate_dte_sale_detail_id_fkey
    FOREIGN KEY (candidate_dte_sale_detail_id) REFERENCES public.dte_sale_details(id) ON DELETE SET NULL,
  CONSTRAINT event_dte_auto_link_attempts_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT event_dte_auto_link_attempts_status_check
    CHECK (status IN ('LINKED', 'SKIPPED')),
  CONSTRAINT event_dte_auto_link_attempts_confidence_check
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100))
);

CREATE INDEX IF NOT EXISTS event_dte_auto_link_attempts_event_id_created_at_idx
  ON public.event_dte_auto_link_attempts(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS event_dte_auto_link_attempts_candidate_dte_sale_detail_id_idx
  ON public.event_dte_auto_link_attempts(candidate_dte_sale_detail_id);

CREATE INDEX IF NOT EXISTS event_dte_auto_link_attempts_created_at_idx
  ON public.event_dte_auto_link_attempts(created_at DESC);
