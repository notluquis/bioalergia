-- Allow multiple DTE sale links per event while keeping each DTE exclusive to one event

DROP INDEX IF EXISTS public.event_dte_sale_links_event_id_key;

-- Production already contains duplicate links for some DTEs.
-- Keep the strongest/most recent record per DTE before enforcing exclusivity.
WITH ranked_links AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY dte_sale_detail_id
      ORDER BY confidence_score DESC, updated_at DESC, created_at DESC, id DESC
    ) AS row_num
  FROM public.event_dte_sale_links
),
duplicate_links AS (
  SELECT id
  FROM ranked_links
  WHERE row_num > 1
)
DELETE FROM public.event_dte_sale_links
WHERE id IN (SELECT id FROM duplicate_links);

CREATE UNIQUE INDEX IF NOT EXISTS event_dte_sale_links_dte_sale_detail_id_key
  ON public.event_dte_sale_links(dte_sale_detail_id);

CREATE INDEX IF NOT EXISTS event_dte_sale_links_event_id_idx
  ON public.event_dte_sale_links(event_id);
