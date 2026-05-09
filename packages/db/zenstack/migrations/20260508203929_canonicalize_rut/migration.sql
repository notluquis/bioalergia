-- Goal: enforce that people.rut is always stored in canonical form
-- "<digits>-<DV>" (e.g. "20275995-5") so that two records can never
-- represent the same identity in different formats. Same canonical form
-- is also enforced going forward by the application layer (lib/rut
-- requireCanonicalRut + canonicalRutFilter).

-- ─── 1. Resolve known canonical/non-canonical duplicate (Lucas, Person 2 + 31)
-- Person 2 has rut "20275995-5" + employee + user but no patient.
-- Person 31 has rut "20.275.995-5" + duplicate employee/user + the only
-- patient profile. Move the patient to Person 2 and drop Person 31's
-- duplicate employee/user/person rows so the canonicalization below can
-- safely apply without unique-constraint conflicts.
UPDATE patients SET person_id = 2 WHERE person_id = 31;
DELETE FROM users WHERE person_id = 31;
DELETE FROM employees WHERE person_id = 31;
DELETE FROM addresses WHERE person_id = 31;
DELETE FROM people WHERE id = 31;

-- ─── 2. Canonicalize all remaining people.rut values
-- "20.275.995-5" → "20275995-5", "12.345.678-k" → "12345678-K", etc.
WITH canonical AS (
  SELECT
    id,
    CASE
      WHEN rut IS NULL THEN NULL
      ELSE
        CASE
          WHEN length(regexp_replace(upper(rut), '[^0-9K]', '', 'g')) < 2 THEN rut
          ELSE
            (substring(regexp_replace(upper(rut), '[^0-9K]', '', 'g')
               from 1
               for length(regexp_replace(upper(rut), '[^0-9K]', '', 'g')) - 1)::bigint)::text
            || '-'
            || substring(regexp_replace(upper(rut), '[^0-9K]', '', 'g')
                 from length(regexp_replace(upper(rut), '[^0-9K]', '', 'g'))
                 for 1)
        END
    END AS canonical_rut
  FROM people
)
UPDATE people p
SET rut = c.canonical_rut
FROM canonical c
WHERE p.id = c.id
  AND p.rut IS NOT NULL
  AND p.rut <> c.canonical_rut;

-- ─── 3. Enforce the canonical format at the DB level so future writes
-- that bypass the application layer cannot reintroduce the bad shape.
ALTER TABLE people
  ADD CONSTRAINT people_rut_canonical_format
  CHECK (rut IS NULL OR rut ~ '^[0-9]+-[0-9K]$');
