# PostgreSQL Row-Level Security (defense in depth)

## Status

**Migration shipped, policies declared, tables NOT enabled.** Roll-out
is gated by env `DB_RLS_ENABLED` AND the per-table
`ALTER TABLE … ENABLE/FORCE ROW LEVEL SECURITY` statements documented
below. Both must be flipped together — flipping only one leaks rows
either to everyone (if env off) or to no one (if env on, tables
enabled, but middleware missed setting the GUC).

## Why

HIPAA Security Rule §164.312(a)(1) "Access control" + Chile Ley 20.584
require restricting access to ePHI / ficha clínica to the providers
who participate in the care relationship. ZenStack `@@allow` policies
already enforce this at the application layer; RLS adds a second
layer at the database layer so a future bug or a manual `psql` session
cannot leak rows belonging to another clinician.

This is **defense in depth**, not a substitute for the application
layer policies. Authorization decisions still live in ZenStack; RLS
just refuses to return rows the GUC says the current user shouldn't
see.

## Architecture

```
┌─ HTTP request ──────────────────────────────────────────┐
│                                                          │
│  Hono auth resolver populates c.get('sessionUser')       │
│                                                          │
│  rlsContextMiddleware (DB_RLS_ENABLED=1 only)            │
│   └─ SELECT set_config('app.current_user_id', $id,false) │
│                                                          │
│  Handler runs queries on the SAME pool connection        │
│   └─ Postgres reads current_setting('app.current_user_id')│
│      via the LEAKPROOF helper current_app_user()         │
│   └─ RLS policies WHERE user_id = current_app_user() …   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

The session-level `set_config(..., false)` is mandatory because most
app code runs on auto-commit (no enclosing transaction). The pool
reuses connections so EVERY request that touches a connection must
re-set the GUC — `rlsContextMiddleware` does this for HTTP requests.
Background jobs (`cron`, `wa-cloud-broadcast-runner`,
`google-calendar-scheduler`) do NOT have a user identity and must
either:

- Run as the `app_migrator` role (`BYPASSRLS`), or
- Explicitly set the GUC to a service account user id.

## Activation checklist

1. **Mint two roles in Railway PG** (run as `postgres`, one-time):

   ```sql
   ALTER ROLE app_user        WITH LOGIN PASSWORD '<chosen>' NOSUPERUSER NOBYPASSRLS;
   ALTER ROLE app_migrator    WITH LOGIN PASSWORD '<chosen>' NOSUPERUSER BYPASSRLS;
   GRANT CONNECT ON DATABASE railway TO app_user, app_migrator;
   GRANT USAGE ON SCHEMA public, personal TO app_user, app_migrator;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, personal TO app_user;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, personal TO app_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public, personal
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public, personal
     GRANT USAGE, SELECT ON SEQUENCES TO app_user;
   GRANT app_user, app_migrator TO postgres;
   ```

2. **Switch the runtime DATABASE_URL to `app_user`**. Keep
   `app_migrator` credentials in a separate env var (e.g.
   `MIGRATION_DATABASE_URL`) and use it only for `pnpm migrate:deploy`.

3. **Set `DB_RLS_ENABLED=1`** in Railway api service. Restart api.

4. **Verify in a deploy preview, not in prod**. Run:

   ```sql
   -- As app_user with a test user id set:
   SELECT set_config('app.current_user_id', '42', false);
   SELECT id FROM patients LIMIT 5;     -- returns rows
   SELECT set_config('app.current_user_id', '', false);
   SELECT id FROM patients LIMIT 5;     -- returns 0 rows (NULL user)
   ```

5. **Enable + FORCE per table**, one at a time, smoke-testing the
   intranet for that table's screens after each:

   ```sql
   ALTER TABLE patients              ENABLE ROW LEVEL SECURITY;
   ALTER TABLE patients              FORCE  ROW LEVEL SECURITY;
   -- intranet smoke: load /patients, search, open one — confirm 0 leak
   ALTER TABLE clinical_series       ENABLE ROW LEVEL SECURITY;
   ALTER TABLE clinical_series       FORCE  ROW LEVEL SECURITY;
   ALTER TABLE clinical_skin_tests   ENABLE ROW LEVEL SECURITY;
   ALTER TABLE clinical_skin_tests   FORCE  ROW LEVEL SECURITY;
   ```

   `FORCE` makes the policy apply to the table owner too — without it,
   a connection authenticated as `postgres` (the owner) would bypass
   RLS even with `app_user` set.

6. **Snapshot tests** in `apps/api/src/orpc/__tests__/` per router
   that touches an RLS table. Seed two users (clinician_a,
   clinician_b) + a patient assigned to A. Assert clinician_b's
   `findMany` returns 0 rows and clinician_a's returns 1.

## Performance

`current_app_user()` is `STABLE LEAKPROOF PARALLEL SAFE` so the
planner can fold it and use indexes. Without `LEAKPROOF`, the policy
predicate runs *before* index quals and forces a sequential scan on
every query — Bytebase's "Postgres RLS Footguns" essay (2024) is the
canonical warning.

Always have an index on the column the policy filters on. The
existing indexes on `patients.id`, `clinical_series.patient_id`,
`clinical_skin_tests.clinical_series_id` are sufficient for the
declared policies. New policies should be paired with their index
in the same migration.

## Rolling back

If a query starts returning empty unexpectedly:

```sql
ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;   -- emergency only
```

Or unset env `DB_RLS_ENABLED` and restart api — middleware stops
binding the GUC, queries see `NULL`, the admin policy still allows
super_admin / admin / doctor through. Other queries get 0 rows;
intranet shows empty lists rather than leaking data.

The migration drops + recreates each policy on every apply, so a
roll-forward fix-up is a single-line edit + `migrate deploy`.

## What is NOT covered

- **Encryption** of patient columns at rest — separate concern,
  recommended for RUT and free-text diagnoses via
  `pgcrypto.pgp_sym_encrypt`. RLS is access control, not encryption
  (HIPAA distinguishes §164.312(a)(1) from §164.312(a)(2)(iv)).
- **TLS in transit** — Railway PG provides this; verify
  `sslmode=verify-full` in the connection string for production.
- **Row-level audit** — `audit_logs` records the application action;
  it does NOT log every SELECT against an RLS table. PG-side query
  auditing requires `pgaudit` (not installed on Railway managed PG).

## References

- [PostgreSQL 18 §5.9 Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL 18 §9.27.1 set_config / current_setting](https://www.postgresql.org/docs/current/functions-admin.html)
- [Bytebase — Postgres RLS Footguns](https://www.bytebase.com/blog/postgres-row-level-security-footguns/)
- [AWS Prescriptive Guidance — RLS for SaaS multi-tenant Postgres](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html)
- [HHS HIPAA Security Rule 45 CFR §164.312](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312)
- [Ley 20.584 Chile](https://www.bcn.cl/leychile/navegar?idNorma=1039348)
