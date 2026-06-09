-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Job Radar — muevete (Falabella) pasa a toggle global (como BCI)
-- Generado a mano — aplicar con: pnpm -F @finanzas/db migrate:deploy
-- Idempotente. Borra la fila MUEVETE de job_sources (ahora es `jobRadar.muevete`
-- en settings, default ON). El valor de enum 'MUEVETE' queda (inofensivo, sin uso).
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM "personal"."job_sources" WHERE "kind" = 'MUEVETE';

-- Default ON: solo sembramos el setting si el usuario aún no lo tocó.
INSERT INTO "public"."settings" ("key", "value")
VALUES ('jobRadar.muevete', 'true')
ON CONFLICT ("key") DO NOTHING;
