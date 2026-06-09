-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Job Radar — kinds nuevos (SF-classic / Genomawork / HiringRoom / Buk / Hirefront)
-- Aplicar con: pnpm -F @finanzas/db migrate:deploy. Solo agrega valores al enum;
-- el seed va en la migración siguiente (PG no usa un enum value en la misma txn
-- que lo crea).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'SFCLASSIC';
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'GENOMAWORK';
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'HIRINGROOM';
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'BUK';
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'HIREFRONT';
