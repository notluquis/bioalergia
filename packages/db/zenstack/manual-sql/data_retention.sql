-- Data retention policies table — additive, idempotent.
-- Legal basis: Ley 21.719 (principio de limitación del plazo de conservación,
-- vigente 1-dic-2026): la PII vencida se elimina/anonimiza de forma sistemática.
-- La FICHA CLÍNICA se conserva 15 años (Decreto 41/2012) y NUNCA se toca — las
-- tablas clínicas no llevan fila aquí y el servicio (lib/retention-sweep.ts)
-- mantiene además un denylist hard-coded.
--
-- Run by a human via psql against prod, NOT `zen migrate deploy`
-- (repo rule: cambios aditivos vía psql IF NOT EXISTS — prod tiene drift).
-- After running, `pnpm -F @finanzas/db build` keeps the generated client in
-- sync (schema.zmodel already carries this model).
--
--   psql "$DATABASE_URL" -f data_retention.sql

CREATE TABLE IF NOT EXISTS "data_retention_policies" (
  "table"         text        PRIMARY KEY,
  "enabled"       boolean     NOT NULL DEFAULT false,
  "action"        text        NOT NULL,
  "window_days"   integer     NOT NULL,
  "date_column"   text        NOT NULL DEFAULT 'created_at',
  "anonymize_map" jsonb       NOT NULL DEFAULT '{}'::jsonb,
  "notes"         text,
  "updated_at"    timestamptz NOT NULL DEFAULT now()
);

-- Seed the default policies (all DISABLED — flip `enabled=true` per table
-- after reviewing the window). ON CONFLICT DO NOTHING so a re-run never
-- clobbers an operator-tuned window. NONE of these are clinical/ficha tables.
INSERT INTO "data_retention_policies"
  ("table", "enabled", "action", "window_days", "date_column", "anonymize_map", "notes")
VALUES
  ('audit_logs',          false, 'delete',    1095, 'occurred_at', '{}'::jsonb,
   'Ley 20.584 + 21.719: audit trail 3 años (forense/compliance), luego purga.'),
  ('login_attempts',      false, 'delete',     180, 'created_at',  '{}'::jsonb,
   'Intentos de login: ventana corta para anti-brute-force, no es PII duradera.'),
  ('wa_messages',         false, 'anonymize',  730, 'created_at',
   '{"body":{"set":"null"},"media_url":{"set":"null"}}'::jsonb,
   'Mensajería WhatsApp: anonimizar cuerpo/media tras 2 años, conservar metadata.'),
  ('email_events',        false, 'delete',     365, 'created_at',  '{}'::jsonb,
   'Eventos de entrega de email (Resend webhooks): 1 año.'),
  ('push_subscriptions',  false, 'delete',     365, 'created_at',  '{}'::jsonb,
   'Suscripciones Web Push obsoletas: limpiar tras 1 año de inactividad.'),
  ('outreach_deliveries', false, 'anonymize',  730, 'created_at',
   '{"contact_email":{"set":"hash"},"contact_phone":{"set":"hash"}}'::jsonb,
   'Campañas outreach: hashear contacto tras 2 años, conservar estadística.')
ON CONFLICT ("table") DO NOTHING;
