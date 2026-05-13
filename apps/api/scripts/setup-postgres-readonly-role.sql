-- E2E read-only safety — defense-in-depth layer 3 (DB).
--
-- Run as a superuser on the target Postgres (Railway provides one).
-- Creates a role with SELECT on everything in `public`, then sets up
-- default privileges so future tables inherit the grant. The role's
-- password is read from psql variable `:'pw'`; pass it explicitly:
--
--   psql "$DATABASE_URL" \
--     -v pw="$(openssl rand -base64 32)" \
--     -f apps/api/scripts/setup-postgres-readonly-role.sql
--
-- Capture the password, save it as DATABASE_URL_READONLY in Railway
-- with the SAME host/port/database but the e2e_readonly user + this
-- password. The backend must then wire a request-scoped middleware
-- that swaps the Kysely pool when the request carries the E2E role
-- (NOT done in this commit — invasive).
--
-- Idempotent: re-running rotates the password and refreshes grants.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'e2e_readonly') THEN
    EXECUTE format('CREATE ROLE e2e_readonly LOGIN PASSWORD %L', :'pw');
  ELSE
    EXECUTE format('ALTER ROLE e2e_readonly WITH PASSWORD %L', :'pw');
  END IF;
END
$$;

GRANT CONNECT ON DATABASE current_database TO e2e_readonly;
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
