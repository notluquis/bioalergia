-- Quitar Citi (Workday): no tiene ofertas en Chile ni remotas.
-- Idempotente: borra la fuente y cualquier oferta ya scrapeada de Citi.
DELETE FROM "personal"."job_sources"
  WHERE "kind" = 'WORKDAY' AND "identifier" = 'citi:wd5:2';

DELETE FROM "personal"."job_postings"
  WHERE "source" = 'workday' AND ("company" ILIKE '%citi%');
