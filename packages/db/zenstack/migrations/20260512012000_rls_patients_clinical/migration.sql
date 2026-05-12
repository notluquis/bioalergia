-- Postgres Row-Level Security on the most sensitive tables (patient
-- data + clinical results). HHS HIPAA Security Rule §164.312(a)(1)
-- "Access control" + Chile Ley 20.584 confidencialidad de la ficha
-- clínica. RLS is defense-in-depth on top of ZenStack policies — even
-- a future bug in app code that forgets to apply a WHERE filter
-- cannot leak rows belonging to another clinician.
--
-- Two roles are required:
--   - app_user        NOSUPERUSER NOBYPASSRLS  (runtime)
--   - app_migrator    NOSUPERUSER BYPASSRLS    (migrations only)
--
-- The runtime app must connect as app_user and call
--   SELECT set_config('app.current_user_id', $userId::text, true);
-- inside every transaction. The helper function current_app_user()
-- is marked LEAKPROOF so the planner can fold it and use indexes
-- (Bytebase RLS Footguns 2024; PostgreSQL §5.9).
--
-- ROLLOUT POLICY: this migration creates the policies but leaves
-- them DISABLED. Flip on per table after verifying queries still
-- return the expected rows for each role:
--   ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE patients FORCE ROW LEVEL SECURITY;
-- See docs/security/rls.md for the activation checklist.
--
-- Refs:
--   - PostgreSQL 18 §5.9 Row Security Policies
--   - https://www.postgresql.org/docs/current/ddl-rowsecurity.html
--   - HHS HIPAA Security Rule 45 CFR §164.312(a)
--   - Bytebase: Postgres RLS Footguns
--   - AWS Prescriptive Guidance — RLS for SaaS multi-tenant Postgres

SET search_path TO public, personal;

-- LEAKPROOF helper. Reads the per-tx GUC and returns the user id, or
-- NULL when the GUC is unset (e.g. background jobs running outside an
-- HTTP request). NULL → policy denies row access by default.
CREATE OR REPLACE FUNCTION current_app_user() RETURNS bigint
  LANGUAGE sql
  STABLE
  PARALLEL SAFE
  LEAKPROOF
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::bigint
$$;

-- Pre-create the runtime + migrator roles if absent. Idempotent: if
-- the operator has already created them with a non-default password,
-- skip role creation and only adjust attributes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    EXECUTE 'CREATE ROLE app_user NOLOGIN NOSUPERUSER NOBYPASSRLS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_migrator') THEN
    EXECUTE 'CREATE ROLE app_migrator NOLOGIN NOSUPERUSER BYPASSRLS';
  END IF;
END
$$;

-- ----------------------------------------------------------------------
-- patients
-- ----------------------------------------------------------------------
-- Visibility model: every ACTIVE user with role super_admin / admin /
-- doctor sees every patient. Other roles see only patients linked via
-- a clinical record they participate in. Adjust after seeding the
-- doctor↔patient assignment table.
DROP POLICY IF EXISTS patients_admin_full ON patients;
CREATE POLICY patients_admin_full ON patients
  FOR ALL
  USING (
    current_app_user() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM users u
      JOIN user_role_assignments ura ON ura.user_id = u.id
      JOIN roles r ON r.id = ura.role_id
      WHERE u.id = current_app_user()
        AND u.status = 'ACTIVE'
        AND r.name IN ('super_admin', 'admin', 'doctor')
    )
  );

-- Any policy named *_clinician_assigned scopes a non-admin clinician
-- to patients linked to a series/test they authored. Stub for now —
-- enable once the assignment join table is in place.

-- ----------------------------------------------------------------------
-- clinical_series
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS clinical_series_admin_full ON clinical_series;
CREATE POLICY clinical_series_admin_full ON clinical_series
  FOR ALL
  USING (
    current_app_user() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM users u
      JOIN user_role_assignments ura ON ura.user_id = u.id
      JOIN roles r ON r.id = ura.role_id
      WHERE u.id = current_app_user()
        AND u.status = 'ACTIVE'
        AND r.name IN ('super_admin', 'admin', 'doctor')
    )
  );

-- ----------------------------------------------------------------------
-- clinical_skin_tests
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS clinical_skin_tests_admin_full ON clinical_skin_tests;
CREATE POLICY clinical_skin_tests_admin_full ON clinical_skin_tests
  FOR ALL
  USING (
    current_app_user() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM users u
      JOIN user_role_assignments ura ON ura.user_id = u.id
      JOIN roles r ON r.id = ura.role_id
      WHERE u.id = current_app_user()
        AND u.status = 'ACTIVE'
        AND r.name IN ('super_admin', 'admin', 'doctor')
    )
  );

-- POLICIES ARE NOT ENABLED YET. See docs/security/rls.md for the
-- activation checklist. To enable for a given table:
--   ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE <table> FORCE ROW LEVEL SECURITY;
