-- Name matching improvement: unaccent + word_similarity
--
-- Adds the unaccent extension and an immutable f_unaccent() wrapper so it can
-- be used in index expressions (standard unaccent() is STABLE, not IMMUTABLE).
-- Replaces the existing client_name GIN index with one that normalises
-- accents, enabling:
--   - "yanez" to match "yañez"
--   - word_similarity() for partial-name retrieval (query is a substring of the
--     full stored name, e.g. "nadia yanez" finding "YAÑEZ ROJAS NADIA VALENTINA")

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Immutable wrapper required for use in index expressions.
-- Calls unaccent with an explicit dictionary reference so Postgres accepts
-- the IMMUTABLE declaration (the unaccent() built-in is only STABLE).
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  RETURNS NULL ON NULL INPUT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- Drop the old index (lower only, no unaccent) and rebuild with f_unaccent.
-- Using CONCURRENTLY on CREATE so Railway can apply this without a table lock;
-- DROP is not concurrent but the table is small enough that downtime is
-- negligible.
DROP INDEX IF EXISTS dte_sale_details_client_name_trgm_idx;

CREATE INDEX CONCURRENTLY IF NOT EXISTS dte_sale_details_client_name_trgm_idx
  ON public.dte_sale_details
  USING GIN (f_unaccent(lower(client_name)) gin_trgm_ops);
