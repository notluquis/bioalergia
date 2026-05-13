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
-- Capture the password, save it as DATABASE_URL_READONLY in Railway
-- with the SAME host/port/database but the e2e_readonly user + this
-- password. Backend pool-rotation is documented as PUNTED in
-- CLAUDE.local.md — the env var has no consumer yet but the DB
-- grants are in place for when (if) it lands.
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
