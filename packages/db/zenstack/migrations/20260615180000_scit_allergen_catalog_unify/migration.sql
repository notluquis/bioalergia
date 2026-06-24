-- Unificación catálogo SCIT: la calculadora pasa a referenciar ClinicalAllergen
-- (fuente de verdad única, compartida con presupuesto/exam-reports).
-- Aditivo + idempotente (regla repo: solo INSERT ... ON CONFLICT DO NOTHING).

-- 1) Fila faltante: "Mezcla de gramíneas" (concepto comercial SCIT; el catálogo
--    skin-test solo tenía las 18 gramíneas individuales, sin fila de mezcla).
INSERT INTO "clinical_allergens"
  ("id", "scientific_name", "common_name", "english_name", "category", "category_en",
   "pollen_type", "pollen_type_en", "normalized_scientific_name", "normalized_common_name", "source")
VALUES
  ('alg_grass_mix', NULL, 'Mezcla de gramíneas', 'Grass mix',
   'Pólenes — gramíneas', 'Pollens — grasses', 'Gramínea', 'Grass',
   NULL, 'MEZCLA DE GRAMINEAS', 'scit_calculator')
ON CONFLICT DO NOTHING;

-- 2) Alias faltantes para que el cruce por nombre funcione en ambos sentidos:
--    - gato/perro tienen scientific_name NULL → agregar sus nombres científicos.
--    - sinónimos taxonómicos que usa la calculadora (Betula verrucosa = B. alba,
--      Ambrosia artemisiifolia = A. elatior, Platanus acerifolia ≈ P. orientalis).
INSERT INTO "clinical_allergen_aliases" ("id", "allergen_id", "alias", "normalized_alias", "alias_type")
VALUES
  ('alias_scit_felis',      'alg_0097', 'Felis domesticus',        'FELIS DOMESTICUS',        'SCIT'),
  ('alias_scit_feliscatus', 'alg_0097', 'Felis catus',             'FELIS CATUS',             'SCIT'),
  ('alias_scit_canis',      'alg_0100', 'Canis familiaris',        'CANIS FAMILIARIS',        'SCIT'),
  ('alias_scit_betula',     'alg_0044', 'Betula verrucosa',        'BETULA VERRUCOSA',        'SCIT'),
  ('alias_scit_ambrosia',   'alg_0072', 'Ambrosia artemisiifolia', 'AMBROSIA ARTEMISIIFOLIA', 'SCIT'),
  ('alias_scit_platanus',   'alg_0059', 'Platanus acerifolia',     'PLATANUS ACERIFOLIA',     'SCIT'),
  ('alias_scit_grassmix',   'alg_grass_mix', 'Mezcla Phleum/Dactylis', 'MEZCLA PHLEUM DACTYLIS', 'SCIT')
ON CONFLICT DO NOTHING;
