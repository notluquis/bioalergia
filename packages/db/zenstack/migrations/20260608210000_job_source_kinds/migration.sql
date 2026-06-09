-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Job Radar — nuevos kinds de JobSource (SuccessFactors / Trabajando / muevete)
-- Generado a mano (drift en prod) — aplicar con: pnpm -F @finanzas/db migrate:deploy
-- 100% aditivo + idempotente. SOLO agrega valores al enum (el seed va en la
-- migración siguiente: Postgres no permite USAR un valor de enum en la misma
-- transacción que lo agrega).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'SUCCESSFACTORS';
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'TRABAJANDO';
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'MUEVETE';
