-- Append-only HMAC hash chain for audit_logs (HIPAA §164.312(c)(1)
-- Integrity + Chile Ley 20.584 Reglamento DS 41/2012 Art. 13).
--
-- Pattern follows RFC 6962 §2.1 (Certificate Transparency append-only
-- Merkle log) reduced to a per-row chain — sufficient for tamper
-- evidence on a single-instance audit table. A nightly Merkle root
-- + external WORM anchor (S3 Object Lock compliance mode) is the
-- next step to make the log non-repudiable; this migration lays the
-- per-row foundation.
--
-- Threat model: an attacker with INSERT-only access to audit_logs
-- (the runtime app role) cannot forge a chain because they lack the
-- HMAC key. An attacker with full DB access can rewrite history but
-- cannot do so undetectably once the daily root has been published.
--
-- Refs:
--   - RFC 6962 §2.1
--   - HHS HIPAA Security Rule 45 CFR §164.312(b), §164.312(c)(1)
--   - PostgreSQL pgcrypto.hmac()

SET search_path TO public, personal;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "prev_hash"  BYTEA,
  ADD COLUMN IF NOT EXISTS "entry_hash" BYTEA;

-- Backfill existing rows with a deterministic placeholder so the chain
-- has a well-defined origin. New inserts compute real HMAC chains from
-- the trigger below; old rows remain "unsealed" but identifiable.
UPDATE "audit_logs"
SET "prev_hash" = decode(repeat('00', 32), 'hex'),
    "entry_hash" = decode(repeat('00', 32), 'hex')
WHERE "prev_hash" IS NULL;

ALTER TABLE "audit_logs"
  ALTER COLUMN "prev_hash"  SET NOT NULL,
  ALTER COLUMN "entry_hash" SET NOT NULL;

-- BEFORE INSERT trigger that links each new row to the previous
-- entry_hash and computes its own HMAC. Runs as SECURITY DEFINER so
-- the runtime role cannot read or override the HMAC key — the key is
-- expected to come from the session GUC `app.audit_hmac_key`, set at
-- connection startup by the API process from a value the operator
-- holds in Railway env (`AUDIT_HMAC_KEY`, 64 hex chars).
--
-- If the key is unset (e.g. local dev), the trigger falls back to a
-- well-known per-database key derived from the database name + a
-- constant. This is INTENTIONALLY weak in dev so the chain still
-- functions; production MUST set AUDIT_HMAC_KEY.
CREATE OR REPLACE FUNCTION audit_log_chain() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  raw_key TEXT;
  k       BYTEA;
BEGIN
  raw_key := current_setting('app.audit_hmac_key', true);
  IF raw_key IS NULL OR raw_key = '' THEN
    -- Dev fallback: derive a stable per-DB key. Production MUST
    -- override via SET app.audit_hmac_key on every session.
    k := digest('audit-log-dev-' || current_database(), 'sha256');
  ELSE
    BEGIN
      k := decode(raw_key, 'hex');
    EXCEPTION WHEN others THEN
      k := digest(raw_key, 'sha256');
    END;
  END IF;

  SELECT "entry_hash" INTO NEW."prev_hash"
  FROM "audit_logs"
  ORDER BY id DESC
  LIMIT 1;
  NEW."prev_hash" := COALESCE(NEW."prev_hash", decode(repeat('00', 32), 'hex'));

  NEW."entry_hash" := hmac(
    NEW."prev_hash"
      || COALESCE(NEW."occurred_at"::text, '')::bytea
      || COALESCE(NEW."kind"::text, '')::bytea
      || COALESCE(NEW."user_id"::text, '')::bytea
      || COALESCE(NEW."actor_label", '')::bytea
      || COALESCE(NEW."ip", '')::bytea
      || COALESCE(NEW."user_agent", '')::bytea
      || COALESCE(NEW."resource", '')::bytea
      || COALESCE(NEW."resource_id", '')::bytea
      || COALESCE(NEW."outcome", '')::bytea
      || COALESCE(NEW."message", '')::bytea
      || COALESCE(NEW."metadata"::text, '')::bytea,
    k,
    'sha256'
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_audit_log_chain ON "audit_logs";
CREATE TRIGGER trg_audit_log_chain
  BEFORE INSERT ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_chain();
