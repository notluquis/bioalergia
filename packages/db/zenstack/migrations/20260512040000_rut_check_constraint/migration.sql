-- DB-layer RUT integrity check (módulo 11) on people.rut.
--
-- Defence in depth on top of the application factory
-- services/people-factory.ts → requireCanonicalRut. Even a future
-- bug, manual SQL session, or out-of-band ETL cannot store an
-- identity with the wrong DV digit (the historical Ruminot-K vs
-- Ruminot-5 duplicate that triggered this work).
--
-- Implementation: a LEAKPROOF SQL function reproduces the SII
-- módulo-11 algorithm. The CHECK constraint allows NULL (anonymous /
-- pre-RUT records) and any RUT that passes validate_rut_dv. The
-- function is marked IMMUTABLE so the planner can fold it into the
-- check.
--
-- Refs:
--   - SII Chile RUT specification (módulo 11)
--   - HHS HIPAA §164.312(c)(1) Integrity controls
--   - PostgreSQL §11.7 Functional / Index Operator Classes (LEAKPROOF)
SET search_path TO public, personal;

CREATE OR REPLACE FUNCTION public.validate_rut_dv(rut_input TEXT) RETURNS BOOLEAN
  LANGUAGE plpgsql
  IMMUTABLE
  PARALLEL SAFE
  LEAKPROOF
AS $$
DECLARE
  body_text   TEXT;
  dv_text     TEXT;
  dv_expected TEXT;
  i           INT;
  digit       INT;
  multiplier  INT := 2;
  total       INT := 0;
  remainder   INT;
BEGIN
  IF rut_input IS NULL THEN
    RETURN TRUE;
  END IF;
  IF rut_input !~ '^[0-9]+-[0-9K]$' THEN
    RETURN FALSE;
  END IF;
  body_text := split_part(rut_input, '-', 1);
  dv_text   := split_part(rut_input, '-', 2);
  IF length(body_text) = 0 THEN
    RETURN FALSE;
  END IF;
  FOR i IN REVERSE length(body_text)..1 LOOP
    digit      := substring(body_text FROM i FOR 1)::INT;
    total      := total + digit * multiplier;
    multiplier := multiplier + 1;
    IF multiplier > 7 THEN
      multiplier := 2;
    END IF;
  END LOOP;
  remainder := 11 - (total % 11);
  IF remainder = 11 THEN
    dv_expected := '0';
  ELSIF remainder = 10 THEN
    dv_expected := 'K';
  ELSE
    dv_expected := remainder::TEXT;
  END IF;
  RETURN dv_expected = dv_text;
END;
$$;

COMMENT ON FUNCTION public.validate_rut_dv(TEXT) IS
  'Returns TRUE for NULL or for a canonical RUT (body-DV) that passes módulo 11. False otherwise.';

-- Quarantine column for legacy invalid RUTs. The application factory
-- in services/people-factory.ts now rejects these at insert time, but
-- ~338 historical rows imported via bulk SQL carry an invalid DV. We
-- preserve the original string here so the operator can investigate /
-- correct via the patient UI without losing the historical evidence,
-- while NULL-ing people.rut so the CHECK constraint can be VALIDATEd
-- (= enforced for ALL future writes, not just new ones).
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS "rut_legacy_invalid" TEXT;

UPDATE people
SET rut_legacy_invalid = rut,
    rut = NULL
WHERE rut IS NOT NULL
  AND NOT validate_rut_dv(rut);

ALTER TABLE people
  DROP CONSTRAINT IF EXISTS people_rut_valid_mod11;

ALTER TABLE people
  ADD CONSTRAINT people_rut_valid_mod11
  CHECK (validate_rut_dv(rut))
  NOT VALID;

-- Now safe to validate — every remaining people.rut either is NULL
-- (legacy invalid quarantined above) or passes módulo 11.
ALTER TABLE people VALIDATE CONSTRAINT people_rut_valid_mod11;

CREATE INDEX IF NOT EXISTS people_rut_legacy_invalid_idx
  ON people (rut_legacy_invalid)
  WHERE rut_legacy_invalid IS NOT NULL;
