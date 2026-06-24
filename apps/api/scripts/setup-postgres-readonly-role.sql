-- E2E read-only safety — defense-in-depth layer 3 (DB).
--
-- Run as a superuser on the target Postgres (Railway provides one).
-- Creates a role with SELECT on everything in `public`, then sets up
-- default privileges so future tables inherit the grant. The role's
-- password is read from psql variable `:'pw'`; pass it explicitly:
--
--   psql "$DATABASE_URL" \
--     -v pw="$(openssl rand -base64 32 | tr -d '=+/' | head -c 32)" \
--     -f apps/api/scripts/setup-postgres-readonly-role.sql
--
-- WIRED on the HERMETIC (ephemeral, throwaway) E2E Postgres only — see
-- `.github/workflows/e2e-hermetic.yml` + `quality.yml::e2e-and-a11y`.
-- After `seed:synthetic` + `seed-e2e-user` (both need full write access),
-- CI runs this script against the throwaway DB, then points the api
-- webServer that Playwright boots at the e2e_readonly role. Mutations
-- are blocked at the DB so even a bug in the network/app guards can't
-- write — and because the DB is destroyed with the job there's nothing
-- of value to protect anyway (belt-and-suspenders).
--
-- PROD pool-rotation stays PUNTED (CLAUDE.local.md): no backend consumes
-- DATABASE_URL_READONLY against the production pool. This script is only
-- used against the hermetic DB.
--
-- NOT pure SELECT: the authed E2E login MUST still stamp session/lockout
-- state on the `users` row or login itself throws and every authed spec
-- skips vacuously. We grant the EXACT columns the login + per-request
-- session-resolution paths write — nothing more (see the narrow
-- column-level GRANT UPDATE block below for the per-column rationale).
--
-- Idempotent: re-running rotates the password and refreshes grants.

-- psql preprocesses `:'pw'` and `:"dbname"`; DO blocks see the
-- already-substituted text because we wrap each statement with
-- \gexec instead of nesting inside PL/pgSQL.
SELECT current_database() AS dbname \gset

-- Create the role only if missing, then unconditionally set/rotate
-- the password. format(%L) quotes the literal so passwords with
-- punctuation don't break the statement.
SELECT format('CREATE ROLE e2e_readonly LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'e2e_readonly') \gexec

SELECT format('ALTER ROLE e2e_readonly WITH PASSWORD %L', :'pw') \gexec

GRANT CONNECT ON DATABASE :"dbname" TO e2e_readonly;
GRANT USAGE ON SCHEMA public TO e2e_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO e2e_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO e2e_readonly;

-- New tables created in the future inherit SELECT for e2e_readonly
-- so the next migration doesn't silently break the E2E account.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO e2e_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO e2e_readonly;

-- Explicit revoke for the destructive verbs in case any earlier
-- migration accidentally granted them.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM e2e_readonly;

-- ── Narrow write carve-outs so authed E2E LOGIN doesn't break ──────────
-- The blanket REVOKE above strips every write. But the login + session
-- paths in apps/api/src/{orpc/auth.ts,lib/account-lockout.ts,lib/auth.ts,
-- services/auth-user.ts} `await` real UPDATEs on the `users` row; if those
-- throw, login throws → every authed spec skips vacuously (the exact
-- failure mode the hermetic suite exists to avoid).
--
-- Column-level GRANT UPDATE (Postgres supports per-column UPDATE privilege)
-- keeps the surface minimal: e2e_readonly may ONLY touch these auth
-- bookkeeping columns on `users`, nothing else (no clinical/financial data).
--
--   last_activity_at      — resolveSessionUserFromToken() touches it per
--                           request (throttled, fire-and-forget — would be
--                           swallowed, but granting it avoids warn spam);
--                           recordLoginSuccess() + touchLastActivity() set
--                           it on login (AWAITED — would break login).
--   last_login_at         — recordLoginSuccess() (AWAITED) stamps login time.
--   last_login_ip         — recordLoginSuccess() (AWAITED) stamps client IP.
--   failed_login_attempts — recordLoginSuccess() resets it to 0 (AWAITED);
--                           recordLoginFailure() increments it.
--   locked_until          — recordLoginSuccess() clears it (AWAITED);
--                           recordLoginFailure() sets it on lockout.
--
-- session_version is only READ on login (covered by SELECT), never written
-- by the login path, so it is intentionally NOT granted.
GRANT UPDATE (
  last_activity_at,
  last_login_at,
  last_login_ip,
  failed_login_attempts,
  locked_until
) ON users TO e2e_readonly;

-- audit_logs: logAuditEvent() INSERTs a LOGIN_SUCCESS/FAILURE row. Its
-- write is wrapped in try/catch (failure only logs a warning, never
-- throws), so login survives without this grant — but granting INSERT
-- keeps the audit trail intact and silences per-login warn spam on the
-- hermetic run. No UPDATE/DELETE (audit log is append-only by design).
-- INSERT also needs USAGE on the row-id sequence (SELECT alone can't
-- advance nextval()); grant it narrowly for whichever sequence backs the
-- audit_logs PK (covers both `audit_logs_id_seq` and IDENTITY-owned
-- sequences). Wrapped in a DO block so it's a no-op if the column has no
-- owned sequence.
DO $$
DECLARE seqname text;
BEGIN
  seqname := pg_get_serial_sequence('audit_logs', 'id');
  IF seqname IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO e2e_readonly', seqname);
  END IF;
END $$;
