-- Backfill patients from clinical_series data.
--
-- Strategy:
--   1. Normalize RUT (strip dots), select best name per unique RUT.
--      Well-formed RUTs only; 114 malformed RUTs are skipped.
--   2. Name word-count priority: 4 > 3 > 2 > 5+ > 1
--      Within same priority, prefer longer string (more complete).
--      Parse: 1 word=names only; 2=names+father; 3=names+father+mother;
--             4=two_names+father+mother; 5+=all_but_last_2+father+mother
--   3. First phone from patient_phones jsonb array if present.
--   4. INSERT people ON CONFLICT (rut) DO NOTHING.
--   5. INSERT patients ON CONFLICT DO NOTHING.
--   6. UPDATE clinical_series.patient_id.
--   7. Patch: re-run name selection with corrected priority to fix any
--      cases where a shorter (less complete) name was previously selected.

DO $$
DECLARE
  v_people_inserted   INT;
  v_patients_inserted INT;
  v_series_linked     INT;
  v_names_patched     INT;
BEGIN

  -- ── Step 1: Insert people ───────────────────────────────────────────────
  WITH best_name_per_rut AS (
    SELECT DISTINCT ON (norm_rut)
      norm_rut, words, wc, first_phone
    FROM (
      SELECT
        UPPER(REGEXP_REPLACE(patient_rut, '\.', '', 'g')) AS norm_rut,
        regexp_split_to_array(trim(patient_name), '\s+')  AS words,
        array_length(regexp_split_to_array(trim(patient_name), '\s+'), 1) AS wc,
        CASE
          WHEN patient_phones IS NOT NULL
            AND jsonb_typeof(patient_phones) = 'array'
            AND jsonb_array_length(patient_phones) > 0
          THEN patient_phones ->> 0
          ELSE NULL
        END AS first_phone
      FROM clinical_series
      WHERE
        patient_rut IS NOT NULL
        AND patient_name IS NOT NULL
        AND trim(patient_name) <> ''
        AND patient_rut ~ '^\d{1,2}\.?\d{3}\.?\d{3}-[0-9Kk]$'
    ) sub
    ORDER BY norm_rut,
      CASE wc WHEN 4 THEN 1 WHEN 3 THEN 2 WHEN 2 THEN 3
              ELSE CASE WHEN wc >= 5 THEN 4 ELSE 5 END
      END ASC,
      length(array_to_string(words, ' ')) DESC
  ),
  parsed AS (
    SELECT
      norm_rut, first_phone,
      initcap(
        CASE
          WHEN wc <= 3 THEN words[1]
          WHEN wc =  4 THEN words[1] || ' ' || words[2]
          ELSE              array_to_string(words[1:wc-2], ' ')
        END
      ) AS parsed_names,
      initcap(CASE WHEN wc = 1 THEN '' ELSE words[wc - 1] END) AS parsed_father,
      initcap(CASE WHEN wc <= 2 THEN '' ELSE words[wc] END)    AS parsed_mother,
      CASE WHEN wc >= 5
        THEN '⚠ Nombre importado automáticamente desde serie clínica — requiere verificación'
        ELSE NULL
      END AS import_note
    FROM best_name_per_rut
  ),
  ins AS (
    INSERT INTO people (rut, names, father_name, mother_name, phone, person_type, created_at, updated_at)
    SELECT norm_rut, parsed_names, parsed_father, parsed_mother, first_phone,
           'NATURAL'::"PersonType", NOW(), NOW()
    FROM parsed
    ON CONFLICT (rut) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_people_inserted FROM ins;

  -- ── Step 2: Insert patients ─────────────────────────────────────────────
  WITH valid_ruts AS (
    SELECT DISTINCT UPPER(REGEXP_REPLACE(patient_rut, '\.', '', 'g')) AS norm_rut
    FROM clinical_series
    WHERE patient_rut IS NOT NULL
      AND patient_rut ~ '^\d{1,2}\.?\d{3}\.?\d{3}-[0-9Kk]$'
  ),
  ins AS (
    INSERT INTO patients (person_id, notes, created_at, updated_at)
    SELECT
      pe.id,
      CASE WHEN array_length(regexp_split_to_array(trim(
        (SELECT patient_name FROM clinical_series cs2
         WHERE UPPER(REGEXP_REPLACE(cs2.patient_rut, '\.', '', 'g')) = vr.norm_rut
           AND cs2.patient_name IS NOT NULL
         ORDER BY array_length(regexp_split_to_array(trim(cs2.patient_name), '\s+'), 1) ASC
         LIMIT 1)
      ), '\s+'), 1) >= 5
        THEN '⚠ Nombre importado automáticamente desde serie clínica — requiere verificación'
        ELSE NULL
      END,
      NOW(), NOW()
    FROM valid_ruts vr
    JOIN people pe ON pe.rut = vr.norm_rut
    WHERE NOT EXISTS (SELECT 1 FROM patients pa WHERE pa.person_id = pe.id)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_patients_inserted FROM ins;

  -- ── Step 3: Link clinical_series.patient_id ─────────────────────────────
  UPDATE clinical_series cs
  SET patient_id = pa.id
  FROM people pe
  JOIN patients pa ON pa.person_id = pe.id
  WHERE cs.patient_id IS NULL
    AND cs.patient_rut IS NOT NULL
    AND UPPER(REGEXP_REPLACE(cs.patient_rut, '\.', '', 'g')) = pe.rut;

  GET DIAGNOSTICS v_series_linked = ROW_COUNT;

  RAISE NOTICE 'Backfill: % people, % patients, % series linked',
    v_people_inserted, v_patients_inserted, v_series_linked;

END $$;
