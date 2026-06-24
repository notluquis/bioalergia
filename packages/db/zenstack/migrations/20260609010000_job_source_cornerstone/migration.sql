-- Job Radar — kind CORNERSTONE (CSOD). aplicar: pnpm -F @finanzas/db migrate:deploy
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'CORNERSTONE';
