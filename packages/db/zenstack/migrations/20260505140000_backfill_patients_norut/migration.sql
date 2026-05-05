-- Backfill patients from clinical_series rows with null/malformed RUT.
-- Requires person.rut to be nullable (migration 20260505130000).
--
-- Groups unlinked series by normalized patient_name (lowercase, collapsed whitespace).
-- Picks best name variant per group (priority 4>3>2>5+>1 word count).
-- Creates people with rut=NULL and patients with explanatory note.
-- Links clinical_series.patient_id via exact normalized name match.
-- 7 rows remain unlinked: malformed RUT + null patient_name, unrecoverable.

CREATE TEMP TABLE _norut_import AS
WITH norm AS (
  SELECT
    LOWER(TRIM(REGEXP_REPLACE(patient_name, '\s+', ' ', 'g'))) AS norm_name,
    regexp_split_to_array(trim(patient_name), '\s+') AS words,
    array_length(regexp_split_to_array(trim(patient_name), '\s+'), 1) AS wc,
    CASE
      WHEN patient_phones IS NOT NULL
        AND jsonb_typeof(patient_phones) = 'array'
        AND jsonb_array_length(patient_phones) > 0
      THEN patient_phones ->> 0
      ELSE NULL
    END AS first_phone
  FROM clinical_series
  WHERE patient_id IS NULL
    AND patient_name IS NOT NULL
    AND trim(patient_name) <> ''
),
best AS (
  SELECT DISTINCT ON (norm_name)
    norm_name, words, wc, first_phone
  FROM norm
  ORDER BY norm_name,
    CASE wc WHEN 4 THEN 1 WHEN 3 THEN 2 WHEN 2 THEN 3
            ELSE CASE WHEN wc >= 5 THEN 4 ELSE 5 END
    END ASC,
    length(array_to_string(words, ' ')) DESC
)
SELECT
  norm_name,
  initcap(
    CASE
      WHEN wc <= 3 THEN words[1]
      WHEN wc =  4 THEN words[1] || ' ' || words[2]
      ELSE              array_to_string(words[1:wc-2], ' ')
    END
  ) AS parsed_names,
  initcap(CASE WHEN wc = 1 THEN '' ELSE words[wc - 1] END) AS parsed_father,
  initcap(CASE WHEN wc <= 2 THEN '' ELSE words[wc] END)    AS parsed_mother,
  first_phone,
  NULL::INT AS person_id,
  NULL::INT AS patient_id
FROM best;

WITH numbered_import AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY norm_name) AS rn FROM _norut_import
),
ins AS (
  INSERT INTO people (rut, names, father_name, mother_name, phone, person_type, created_at, updated_at)
  SELECT NULL, parsed_names, parsed_father, parsed_mother, first_phone,
         'NATURAL'::"PersonType", NOW(), NOW()
  FROM numbered_import ORDER BY rn
  RETURNING id
),
numbered_ins AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM ins
)
UPDATE _norut_import i SET person_id = ni.id
FROM numbered_ins ni JOIN numbered_import nim ON nim.rn = ni.rn
WHERE i.norm_name = nim.norm_name;

WITH ins AS (
  INSERT INTO patients (person_id, notes, created_at, updated_at)
  SELECT person_id, 'Sin RUT — importado desde serie clínica', NOW(), NOW()
  FROM _norut_import RETURNING id, person_id
)
UPDATE _norut_import i SET patient_id = ins.id FROM ins WHERE ins.person_id = i.person_id;

UPDATE clinical_series cs
SET patient_id = m.patient_id
FROM _norut_import m
WHERE cs.patient_id IS NULL
  AND cs.patient_name IS NOT NULL
  AND LOWER(TRIM(REGEXP_REPLACE(cs.patient_name, '\s+', ' ', 'g'))) = m.norm_name;

SELECT setval('people_id_seq',   (SELECT MAX(id) FROM people));
SELECT setval('patients_id_seq', (SELECT MAX(id) FROM patients));

DROP TABLE _norut_import;
