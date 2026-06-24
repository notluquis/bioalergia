-- Job Radar — 2 ATS nuevos: EIGHTFOLD (Eightfold AI PCSX, ej MercadoLibre/
-- MercadoPago en mercadolibre.eightfold.ai) y MINISITE (white-label Rails+ES por
-- host propio, ej SQM en trabajaensqm.com). ADD VALUE en su propia migración
-- (PG no permite usar el valor nuevo en la misma txn); seed en 20260623005000.
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'EIGHTFOLD';
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'MINISITE';
