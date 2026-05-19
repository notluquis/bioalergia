-- Extiende la taxonomía de cross-reactivity tags con 8 familias nuevas
-- documentadas en literatura 2022-2024 (post EAACI MAUG 2.0):
--
--   polcalcin     Calcium-binding pollen panallergen (Phl p 7, Bet v 4,
--                 Ole e 3, Jun o 4, Cyn d 7, Che a 3, Aln g 4). Baja
--                 prevalencia (~10%) pero relevante para multi-pollen
--                 sensitization patterns. NOTA: cross-reactivity es
--                 "variable" (Karger IAA 2021), no universal.
--
--   defensin      Pollen+food defensin homologs (Art v 1 mugwort + Api g 7
--                 celery root). Familia ampliada en 2024 review.
--
--   grp           Gibberellin-Regulated Protein. Pru p 7 prototype peach;
--                 Cupressaceae pollen (Cup s 7, Cry j 7, Jun a 7);
--                 Citrus (Cit s 7), bell pepper (Cap a 7), pomegranate
--                 (Pun g 7), cherry (Pru av 7), strawberry (Fra a GRP).
--                 *Marcador de severidad* — anaphylaxis risk en cypress-
--                 fruit syndrome (MDPI 2025, Frontiers Allergy 2022).
--
--   2s-albumin    Seed storage protein 2S. Drivers de reacciones
--                 sistémicas (no OAS). Ara h 2/6 (maní), Jug r 1 (nuez),
--                 Cor a 14 (avellana), Ana o 3 (cashew — N/A), Pis v 1
--                 (pistacho), Ber e 1 (Brazil), Ses i 1 (sésamo),
--                 Sin a 1 (mostaza), Pru du 2S (almendra).
--
--   7s-vicilin    Storage protein 7S. Ara h 1, Cor a 11, Jug r 6, Pis v 3,
--                 Ses i 3, Gly m 5 (soja), Cic a 1 (garbanzo), Len c 1
--                 (lenteja), Pis s 1 (guisante), Pha v 1 (poroto).
--                 Walnut-hazelnut 2S/7S cross-reactivity confirmada
--                 (PMC11328161, 2024).
--
--   11s-legumin   Storage protein 11S (cupin superfamily). Ara h 3,
--                 Cor a 9, Jug r 4, Ber e 2, Gly m 6, Pru du 6.
--
--   alpha-gal     Galactose-α-1,3-galactose. Carne roja mamífero (vaca,
--                 cerdo, cordero, conejo). Reacción tardía 3-6h. NOTA:
--                 leche/derivados llevan trazas pero raramente disparan
--                 AGS — no taggeada. Cross-reactivity con saliva
--                 garrapata + cetuximab.
--
--   chitinase     Class I chitinase, latex-fruit syndrome. Hev b 11
--                 (látex), Pers a 1 (palta), Mus a 4 (banana), Cas s 5
--                 (castaña).
--
-- Mecánica: misma función pg_temp.merge_allergen_tags() de la migration
-- 20260518120000 — UNION+DISTINCT, idempotente, no clobber.

CREATE OR REPLACE FUNCTION pg_temp.merge_allergen_tags(p_id TEXT, p_new TEXT[])
RETURNS VOID AS $$
BEGIN
  UPDATE clinical_allergens
     SET tags = ARRAY(
       SELECT DISTINCT t
         FROM unnest(COALESCE(tags, ARRAY[]::TEXT[]) || p_new) AS t
        ORDER BY t
     )
   WHERE id = p_id
     AND NOT (COALESCE(tags, ARRAY[]::TEXT[]) @> p_new);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- polcalcin (pollen calcium-binding panallergen)
-- ============================================================
-- Grasses
SELECT pg_temp.merge_allergen_tags('alg_0024', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0025', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0026', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0027', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0028', ARRAY['polcalcin']); -- Cyn d 7
SELECT pg_temp.merge_allergen_tags('alg_0029', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0030', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0031', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0032', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0033', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0034', ARRAY['polcalcin']); -- Phl p 7 prototype
SELECT pg_temp.merge_allergen_tags('alg_0035', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0036', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0037', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0038', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0039', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0040', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0041', ARRAY['polcalcin']);
-- Trees: Fagales (carry polcalcins as minor)
SELECT pg_temp.merge_allergen_tags('alg_0042', ARRAY['polcalcin']); -- Aln g 4
SELECT pg_temp.merge_allergen_tags('alg_0044', ARRAY['polcalcin']); -- Bet v 4
SELECT pg_temp.merge_allergen_tags('alg_0046', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0061', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0062', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0063', ARRAY['polcalcin']);
-- Oleaceae (Ole e 3, Fra e polcalcin)
SELECT pg_temp.merge_allergen_tags('alg_0053', ARRAY['polcalcin']); -- olivo
SELECT pg_temp.merge_allergen_tags('alg_0050', ARRAY['polcalcin']); -- fresno
SELECT pg_temp.merge_allergen_tags('alg_0066', ARRAY['polcalcin']); -- lila
-- Cupressaceae (Jun o 4, Cup a polcalcin)
SELECT pg_temp.merge_allergen_tags('alg_0047', ARRAY['polcalcin']); -- ciprés Arizona
SELECT pg_temp.merge_allergen_tags('alg_0048', ARRAY['polcalcin']); -- ciprés Med
SELECT pg_temp.merge_allergen_tags('alg_0051', ARRAY['polcalcin']); -- enebro (Jun o 4)
SELECT pg_temp.merge_allergen_tags('alg_0068', ARRAY['polcalcin']); -- thuja
-- Weeds (Che a 3 chenopodium, Sal k 7 salsola, Amb a 9 ambrosia, Art v 5 mugwort)
SELECT pg_temp.merge_allergen_tags('alg_0072', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0073', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0074', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0075', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0077', ARRAY['polcalcin']); -- Che a 3
SELECT pg_temp.merge_allergen_tags('alg_0087', ARRAY['polcalcin']); -- Sal k 7
-- Mixes
SELECT pg_temp.merge_allergen_tags('alg_0211', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0212', ARRAY['polcalcin']);
SELECT pg_temp.merge_allergen_tags('alg_0213', ARRAY['polcalcin']);

-- ============================================================
-- defensin (Art v 1 / Api g 7 family)
-- ============================================================
SELECT pg_temp.merge_allergen_tags('alg_0074', ARRAY['defensin']); -- Artemisia absinthium
SELECT pg_temp.merge_allergen_tags('alg_0075', ARRAY['defensin']); -- Artemisia vulgaris (Art v 1)
SELECT pg_temp.merge_allergen_tags('alg_0173', ARRAY['defensin']); -- apio (Api g 7 root)

-- ============================================================
-- grp (Gibberellin-Regulated Protein) — severe phenotype marker
-- ============================================================
-- Cupressaceae pollen (Cup s 7, Cry j 7, Jun a 7)
SELECT pg_temp.merge_allergen_tags('alg_0047', ARRAY['grp']); -- ciprés Arizona (Cup a 7 documented)
SELECT pg_temp.merge_allergen_tags('alg_0048', ARRAY['grp']); -- ciprés Med (Cup s 7)
SELECT pg_temp.merge_allergen_tags('alg_0051', ARRAY['grp']); -- juniperus (Jun o 7 by homology)
SELECT pg_temp.merge_allergen_tags('alg_0068', ARRAY['grp']); -- thuja
-- Rosaceae fruits (Pru p 7 peach prototype; cherry, strawberry confirmed)
SELECT pg_temp.merge_allergen_tags('alg_0162', ARRAY['grp']); -- durazno (Pru p 7)
SELECT pg_temp.merge_allergen_tags('alg_0156', ARRAY['grp']); -- cereza (Pru av 7)
SELECT pg_temp.merge_allergen_tags('alg_0157', ARRAY['grp']); -- frutilla (Fra a GRP)
-- Citrus (Cit s 7)
SELECT pg_temp.merge_allergen_tags('alg_0159', ARRAY['grp']); -- limón
SELECT pg_temp.merge_allergen_tags('alg_0160', ARRAY['grp']); -- mandarina
SELECT pg_temp.merge_allergen_tags('alg_0164', ARRAY['grp']); -- naranja
SELECT pg_temp.merge_allergen_tags('alg_0167', ARRAY['grp']); -- pomelo
SELECT pg_temp.merge_allergen_tags('alg_0209', ARRAY['grp']); -- cítricos mix
-- Bell pepper (Cap a 7)
SELECT pg_temp.merge_allergen_tags('alg_0178', ARRAY['grp']);

-- ============================================================
-- 2s-albumin (storage protein — systemic reaction marker)
-- ============================================================
SELECT pg_temp.merge_allergen_tags('alg_0147', ARRAY['2s-albumin']); -- maní (Ara h 2, 6)
SELECT pg_temp.merge_allergen_tags('alg_0146', ARRAY['2s-albumin']); -- avellana (Cor a 14)
SELECT pg_temp.merge_allergen_tags('alg_0151', ARRAY['2s-albumin']); -- nuez nogal (Jug r 1)
SELECT pg_temp.merge_allergen_tags('alg_0154', ARRAY['2s-albumin']); -- pistacho (Pis v 1)
SELECT pg_temp.merge_allergen_tags('alg_0150', ARRAY['2s-albumin']); -- Brazil nut (Ber e 1)
SELECT pg_temp.merge_allergen_tags('alg_0145', ARRAY['2s-albumin']); -- almendra (Pru du 2S)
SELECT pg_temp.merge_allergen_tags('alg_0155', ARRAY['2s-albumin']); -- sésamo (Ses i 1, Ses i 2)
SELECT pg_temp.merge_allergen_tags('alg_0194', ARRAY['2s-albumin']); -- mostaza (Sin a 1)

-- ============================================================
-- 7s-vicilin (storage protein 7S — systemic marker)
-- ============================================================
SELECT pg_temp.merge_allergen_tags('alg_0147', ARRAY['7s-vicilin']); -- maní (Ara h 1)
SELECT pg_temp.merge_allergen_tags('alg_0146', ARRAY['7s-vicilin']); -- avellana (Cor a 11)
SELECT pg_temp.merge_allergen_tags('alg_0151', ARRAY['7s-vicilin']); -- nuez (Jug r 6)
SELECT pg_temp.merge_allergen_tags('alg_0154', ARRAY['7s-vicilin']); -- pistacho (Pis v 3)
SELECT pg_temp.merge_allergen_tags('alg_0155', ARRAY['7s-vicilin']); -- sésamo (Ses i 3)
SELECT pg_temp.merge_allergen_tags('alg_0172', ARRAY['7s-vicilin']); -- soja (Gly m 5)
SELECT pg_temp.merge_allergen_tags('alg_0170', ARRAY['7s-vicilin']); -- garbanzo (Cic a 1)
SELECT pg_temp.merge_allergen_tags('alg_0171', ARRAY['7s-vicilin']); -- lenteja (Len c 1)
SELECT pg_temp.merge_allergen_tags('alg_0169', ARRAY['7s-vicilin']); -- poroto (Pha v 1)
SELECT pg_temp.merge_allergen_tags('alg_0176', ARRAY['7s-vicilin']); -- guisante (Pis s 1)

-- ============================================================
-- 11s-legumin (storage protein 11S, cupin superfamily)
-- ============================================================
SELECT pg_temp.merge_allergen_tags('alg_0147', ARRAY['11s-legumin']); -- maní (Ara h 3)
SELECT pg_temp.merge_allergen_tags('alg_0146', ARRAY['11s-legumin']); -- avellana (Cor a 9)
SELECT pg_temp.merge_allergen_tags('alg_0151', ARRAY['11s-legumin']); -- nuez (Jug r 4)
SELECT pg_temp.merge_allergen_tags('alg_0150', ARRAY['11s-legumin']); -- Brazil (Ber e 2)
SELECT pg_temp.merge_allergen_tags('alg_0172', ARRAY['11s-legumin']); -- soja (Gly m 6)
SELECT pg_temp.merge_allergen_tags('alg_0145', ARRAY['11s-legumin']); -- almendra (Pru du 6)

-- ============================================================
-- alpha-gal (red meat delayed reaction)
-- ============================================================
SELECT pg_temp.merge_allergen_tags('alg_0124', ARRAY['alpha-gal']); -- cerdo
SELECT pg_temp.merge_allergen_tags('alg_0125', ARRAY['alpha-gal']); -- conejo carne
SELECT pg_temp.merge_allergen_tags('alg_0126', ARRAY['alpha-gal']); -- cordero
SELECT pg_temp.merge_allergen_tags('alg_0131', ARRAY['alpha-gal']); -- vaca

-- ============================================================
-- chitinase class I (latex-fruit syndrome)
-- ============================================================
SELECT pg_temp.merge_allergen_tags('alg_0115', ARRAY['chitinase']); -- látex (Hev b 11)
SELECT pg_temp.merge_allergen_tags('alg_0165', ARRAY['chitinase']); -- palta (Pers a 1)
SELECT pg_temp.merge_allergen_tags('alg_0166', ARRAY['chitinase']); -- banana (Mus a 4)
SELECT pg_temp.merge_allergen_tags('alg_0148', ARRAY['chitinase']); -- castaña (Cas s 5)

DROP FUNCTION pg_temp.merge_allergen_tags(TEXT, TEXT[]);
