-- Allow multiple DTE sale links per event while keeping each DTE exclusive to one event

DROP INDEX IF EXISTS public.event_dte_sale_links_event_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS event_dte_sale_links_dte_sale_detail_id_key
  ON public.event_dte_sale_links(dte_sale_detail_id);

CREATE INDEX IF NOT EXISTS event_dte_sale_links_event_id_idx
  ON public.event_dte_sale_links(event_id);
