-- Backfill clinical_allergens.tags with EAACI cross-reactivity family
-- markers. Tags are merged into the existing array (never clobber human
-- additions) using array_distinct + UNION pattern via array_cat dedupe.
--
-- Taxonomy (lowercase):
--   pr-10          Bet v 1 homologs — Fagales pollens + rosaceous fruits +
--                  hazelnut + kiwi + celery/carrot + soy
--   profilin       Pan-allergen profilin (Bet v 2 / Phl p 12 family)
--   tropomyosin    Invertebrate (crustaceans + mites + cockroach + mussel /
--                  oyster)
--   ltp            Non-specific Lipid Transfer Proteins (Pru p 3 prototype)
--   serum-albumin  Mammalian serum albumins (Bos d 6, Fel d 2, Can f 3,
--                  Equ c 3) + beta-lactoglobulin is lipocalin not albumin
--   parvalbumin    Fish parvalbumins (Gad c 1 prototype)
--   lipocalin      Mammalian dander lipocalins (Fel d 4, Can f 1/2/6,
--                  Equ c 1, Mus m 1, Rat n 1, Cav p 1) + cow milk Bos d 5
--
-- Sources: EAACI Molecular Allergology User's Guide 2.0 (2022, errata 2024);
-- WAO/EAACI Allergen Nomenclature DB (allergen.org); Skypala et al. 2021
-- LTP syndrome paper (Allergy).
--
-- Pattern: each UPDATE merges (existing tags ∪ new tags) using
-- ARRAY(SELECT DISTINCT unnest(...)) so re-running is safe.

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

-- Mites — invertebrate tropomyosin
SELECT pg_temp.merge_allergen_tags('alg_0002', ARRAY['tropomyosin']);
SELECT pg_temp.merge_allergen_tags('alg_0003', ARRAY['tropomyosin']);
SELECT pg_temp.merge_allergen_tags('alg_0004', ARRAY['tropomyosin']);
SELECT pg_temp.merge_allergen_tags('alg_0005', ARRAY['tropomyosin']);
SELECT pg_temp.merge_allergen_tags('alg_0006', ARRAY['tropomyosin']);
SELECT pg_temp.merge_allergen_tags('alg_0007', ARRAY['tropomyosin']);
SELECT pg_temp.merge_allergen_tags('alg_0008', ARRAY['tropomyosin']);
SELECT pg_temp.merge_allergen_tags('alg_0009', ARRAY['tropomyosin']);

-- Cockroaches — tropomyosin
SELECT pg_temp.merge_allergen_tags('alg_0110', ARRAY['tropomyosin']);
SELECT pg_temp.merge_allergen_tags('alg_0111', ARRAY['tropomyosin']);
SELECT pg_temp.merge_allergen_tags('alg_0112', ARRAY['tropomyosin']);

-- Crustaceans + mollusks — tropomyosin
SELECT pg_temp.merge_allergen_tags('alg_0141', ARRAY['tropomyosin']); -- cangrejo
SELECT pg_temp.merge_allergen_tags('alg_0142', ARRAY['tropomyosin']); -- gamba
SELECT pg_temp.merge_allergen_tags('alg_0143', ARRAY['tropomyosin']); -- langostino
SELECT pg_temp.merge_allergen_tags('alg_0144', ARRAY['tropomyosin']); -- mejillón
SELECT pg_temp.merge_allergen_tags('alg_0207', ARRAY['tropomyosin']); -- ostra

-- House dust mix (mites dominate) — tropomyosin
SELECT pg_temp.merge_allergen_tags('alg_0202', ARRAY['tropomyosin']);

-- Fish — parvalbumin
SELECT pg_temp.merge_allergen_tags('alg_0132', ARRAY['parvalbumin']); -- arenque
SELECT pg_temp.merge_allergen_tags('alg_0133', ARRAY['parvalbumin']); -- atún
SELECT pg_temp.merge_allergen_tags('alg_0134', ARRAY['parvalbumin']); -- bacalao
SELECT pg_temp.merge_allergen_tags('alg_0135', ARRAY['parvalbumin']); -- caballa
SELECT pg_temp.merge_allergen_tags('alg_0136', ARRAY['parvalbumin']); -- lenguado
SELECT pg_temp.merge_allergen_tags('alg_0137', ARRAY['parvalbumin']); -- merluza
SELECT pg_temp.merge_allergen_tags('alg_0138', ARRAY['parvalbumin']); -- platija
SELECT pg_temp.merge_allergen_tags('alg_0139', ARRAY['parvalbumin']); -- salmón
SELECT pg_temp.merge_allergen_tags('alg_0140', ARRAY['parvalbumin']); -- trucha
SELECT pg_temp.merge_allergen_tags('alg_0208', ARRAY['parvalbumin']); -- pescado blanco mix

-- Mammalian danders — lipocalin + serum-albumin
SELECT pg_temp.merge_allergen_tags('alg_0091', ARRAY['lipocalin','serum-albumin']); -- caballo (Equ c 1 + Equ c 3)
SELECT pg_temp.merge_allergen_tags('alg_0092', ARRAY['serum-albumin']);              -- cabra
SELECT pg_temp.merge_allergen_tags('alg_0093', ARRAY['serum-albumin']);              -- camello
SELECT pg_temp.merge_allergen_tags('alg_0094', ARRAY['serum-albumin']);              -- cerdo (Sus s 1)
SELECT pg_temp.merge_allergen_tags('alg_0095', ARRAY['lipocalin','serum-albumin']); -- cobaya (Cav p 1+4)
SELECT pg_temp.merge_allergen_tags('alg_0096', ARRAY['lipocalin','serum-albumin']); -- conejo (Ory c 1 + Ory c 6)
SELECT pg_temp.merge_allergen_tags('alg_0097', ARRAY['lipocalin','serum-albumin']); -- gato (Fel d 4 + Fel d 2)
SELECT pg_temp.merge_allergen_tags('alg_0098', ARRAY['lipocalin']);                 -- hamster
SELECT pg_temp.merge_allergen_tags('alg_0099', ARRAY['serum-albumin']);              -- oveja
SELECT pg_temp.merge_allergen_tags('alg_0100', ARRAY['lipocalin','serum-albumin']); -- perro (Can f 1/2/6 + Can f 3)
SELECT pg_temp.merge_allergen_tags('alg_0101', ARRAY['lipocalin']);                 -- rata (Rat n 1)
SELECT pg_temp.merge_allergen_tags('alg_0102', ARRAY['lipocalin']);                 -- ratón (Mus m 1)
SELECT pg_temp.merge_allergen_tags('alg_0103', ARRAY['lipocalin','serum-albumin']); -- vaca (Bos d 2 + Bos d 6)

-- Mammalian meats — serum-albumin
SELECT pg_temp.merge_allergen_tags('alg_0124', ARRAY['serum-albumin']); -- cerdo
SELECT pg_temp.merge_allergen_tags('alg_0125', ARRAY['serum-albumin']); -- conejo carne
SELECT pg_temp.merge_allergen_tags('alg_0126', ARRAY['serum-albumin']); -- cordero
SELECT pg_temp.merge_allergen_tags('alg_0131', ARRAY['serum-albumin']); -- vaca

-- Cow milk — Bos d 5 (BLG) is a lipocalin; Bos d 6 (BSA) is serum-albumin
SELECT pg_temp.merge_allergen_tags('alg_0118', ARRAY['lipocalin']);                 -- beta-lactoglobulin
SELECT pg_temp.merge_allergen_tags('alg_0120', ARRAY['lipocalin','serum-albumin']); -- leche vaca
SELECT pg_temp.merge_allergen_tags('alg_0210', ARRAY['lipocalin','serum-albumin']); -- leche cocida

-- Fagales tree pollens — pr-10 + profilin
SELECT pg_temp.merge_allergen_tags('alg_0042', ARRAY['pr-10','profilin']); -- aliso (Alnus)
SELECT pg_temp.merge_allergen_tags('alg_0044', ARRAY['pr-10','profilin']); -- abedul (Betula)
SELECT pg_temp.merge_allergen_tags('alg_0045', ARRAY['pr-10','profilin']); -- castaño (Castanea)
SELECT pg_temp.merge_allergen_tags('alg_0046', ARRAY['pr-10','profilin']); -- avellano (Corylus)
SELECT pg_temp.merge_allergen_tags('alg_0061', ARRAY['pr-10','profilin']); -- encina (Quercus ilex)
SELECT pg_temp.merge_allergen_tags('alg_0062', ARRAY['pr-10','profilin']); -- roble melojo
SELECT pg_temp.merge_allergen_tags('alg_0063', ARRAY['pr-10','profilin']); -- roble común
SELECT pg_temp.merge_allergen_tags('alg_0212', ARRAY['pr-10','profilin']); -- tree mix
SELECT pg_temp.merge_allergen_tags('alg_0213', ARRAY['pr-10','profilin']); -- árboles parque

-- Other tree pollens — profilin only (not Fagales / no PR-10)
SELECT pg_temp.merge_allergen_tags('alg_0043', ARRAY['profilin']); -- acer negundo
SELECT pg_temp.merge_allergen_tags('alg_0050', ARRAY['profilin']); -- fresno (Oleaceae)
SELECT pg_temp.merge_allergen_tags('alg_0052', ARRAY['profilin']); -- morera blanca
SELECT pg_temp.merge_allergen_tags('alg_0054', ARRAY['profilin']); -- palmera datilera
SELECT pg_temp.merge_allergen_tags('alg_0055', ARRAY['profilin']); -- pino marítimo
SELECT pg_temp.merge_allergen_tags('alg_0056', ARRAY['profilin']); -- pino piñonero
SELECT pg_temp.merge_allergen_tags('alg_0057', ARRAY['profilin']); -- pino silvestre
SELECT pg_temp.merge_allergen_tags('alg_0060', ARRAY['profilin']); -- álamo (Populus)
SELECT pg_temp.merge_allergen_tags('alg_0064', ARRAY['profilin']); -- sauce (Salix)
SELECT pg_temp.merge_allergen_tags('alg_0065', ARRAY['profilin']); -- saúco
SELECT pg_temp.merge_allergen_tags('alg_0066', ARRAY['profilin']); -- lila (Oleaceae)
SELECT pg_temp.merge_allergen_tags('alg_0069', ARRAY['profilin']); -- tilo
SELECT pg_temp.merge_allergen_tags('alg_0070', ARRAY['profilin']); -- olmo

-- Olive (Olea europaea): Ole e 2 profilin + Ole e 7 LTP
SELECT pg_temp.merge_allergen_tags('alg_0053', ARRAY['profilin','ltp']);

-- Plane tree (Platanus): Pla a 8 profilin + Pla a 3 LTP
SELECT pg_temp.merge_allergen_tags('alg_0058', ARRAY['profilin','ltp']);
SELECT pg_temp.merge_allergen_tags('alg_0059', ARRAY['profilin','ltp']);

-- Grass pollens — profilin (Phl p 12 family)
SELECT pg_temp.merge_allergen_tags('alg_0024', ARRAY['profilin']); -- agropyron
SELECT pg_temp.merge_allergen_tags('alg_0025', ARRAY['profilin']); -- agrostis
SELECT pg_temp.merge_allergen_tags('alg_0026', ARRAY['profilin']); -- anthoxanthum
SELECT pg_temp.merge_allergen_tags('alg_0027', ARRAY['profilin']); -- avena
SELECT pg_temp.merge_allergen_tags('alg_0028', ARRAY['profilin']); -- cynodon
SELECT pg_temp.merge_allergen_tags('alg_0029', ARRAY['profilin']); -- dactylis
SELECT pg_temp.merge_allergen_tags('alg_0030', ARRAY['profilin']); -- festuca
SELECT pg_temp.merge_allergen_tags('alg_0031', ARRAY['profilin']); -- holcus
SELECT pg_temp.merge_allergen_tags('alg_0032', ARRAY['profilin']); -- cebada
SELECT pg_temp.merge_allergen_tags('alg_0033', ARRAY['profilin']); -- lolium
SELECT pg_temp.merge_allergen_tags('alg_0034', ARRAY['profilin']); -- phleum
SELECT pg_temp.merge_allergen_tags('alg_0035', ARRAY['profilin']); -- phragmites
SELECT pg_temp.merge_allergen_tags('alg_0036', ARRAY['profilin']); -- poa
SELECT pg_temp.merge_allergen_tags('alg_0037', ARRAY['profilin']); -- centeno
SELECT pg_temp.merge_allergen_tags('alg_0038', ARRAY['profilin']); -- sorghum
SELECT pg_temp.merge_allergen_tags('alg_0039', ARRAY['profilin']); -- trisetum
SELECT pg_temp.merge_allergen_tags('alg_0040', ARRAY['profilin']); -- trigo
SELECT pg_temp.merge_allergen_tags('alg_0041', ARRAY['profilin']); -- maíz

-- Weed pollens — profilin (Asteraceae, Amaranthaceae, Urticaceae...)
SELECT pg_temp.merge_allergen_tags('alg_0071', ARRAY['profilin']); -- amaranto
SELECT pg_temp.merge_allergen_tags('alg_0076', ARRAY['profilin']); -- colza
SELECT pg_temp.merge_allergen_tags('alg_0077', ARRAY['profilin']); -- quenopodio
SELECT pg_temp.merge_allergen_tags('alg_0078', ARRAY['profilin']); -- margarita
SELECT pg_temp.merge_allergen_tags('alg_0079', ARRAY['profilin']); -- dalia
SELECT pg_temp.merge_allergen_tags('alg_0080', ARRAY['profilin']); -- girasol
SELECT pg_temp.merge_allergen_tags('alg_0081', ARRAY['profilin']); -- kochia
SELECT pg_temp.merge_allergen_tags('alg_0082', ARRAY['profilin']); -- mercurialis
SELECT pg_temp.merge_allergen_tags('alg_0084', ARRAY['profilin']); -- llantén menor
SELECT pg_temp.merge_allergen_tags('alg_0085', ARRAY['profilin']); -- llantén lagopus
SELECT pg_temp.merge_allergen_tags('alg_0086', ARRAY['profilin']); -- acedera
SELECT pg_temp.merge_allergen_tags('alg_0087', ARRAY['profilin']); -- salsola
SELECT pg_temp.merge_allergen_tags('alg_0088', ARRAY['profilin']); -- diente león
SELECT pg_temp.merge_allergen_tags('alg_0089', ARRAY['profilin']); -- ortiga
SELECT pg_temp.merge_allergen_tags('alg_0090', ARRAY['profilin']); -- xanthium

-- Ragweed (Ambrosia) — profilin + LTP (Amb a 6)
SELECT pg_temp.merge_allergen_tags('alg_0072', ARRAY['profilin','ltp']);
SELECT pg_temp.merge_allergen_tags('alg_0073', ARRAY['profilin','ltp']);

-- Mugwort (Artemisia) — profilin (Art v 4) + LTP (Art v 3)
SELECT pg_temp.merge_allergen_tags('alg_0074', ARRAY['profilin','ltp']);
SELECT pg_temp.merge_allergen_tags('alg_0075', ARRAY['profilin','ltp']);

-- Parietaria — LTP (Par j 1/2 are major LTPs) + profilin
SELECT pg_temp.merge_allergen_tags('alg_0083', ARRAY['profilin','ltp']);

-- Weed mix
SELECT pg_temp.merge_allergen_tags('alg_0211', ARRAY['profilin','ltp']);

-- Rosaceae fruits — pr-10 + profilin + ltp (full set)
SELECT pg_temp.merge_allergen_tags('alg_0156', ARRAY['pr-10','profilin','ltp']); -- cereza
SELECT pg_temp.merge_allergen_tags('alg_0157', ARRAY['pr-10','profilin','ltp']); -- fresa
SELECT pg_temp.merge_allergen_tags('alg_0161', ARRAY['pr-10','profilin','ltp']); -- manzana
SELECT pg_temp.merge_allergen_tags('alg_0162', ARRAY['pr-10','profilin','ltp']); -- melocotón/durazno

-- Kiwi — pr-10 + profilin + ltp
SELECT pg_temp.merge_allergen_tags('alg_0158', ARRAY['pr-10','profilin','ltp']);

-- Tomato — pr-10 (Sola l 4) + profilin (Sola l 1) + ltp (Sola l 3)
SELECT pg_temp.merge_allergen_tags('alg_0180', ARRAY['pr-10','profilin','ltp']);

-- Apiaceae food (celery, carrot) — pr-10 + profilin
SELECT pg_temp.merge_allergen_tags('alg_0173', ARRAY['pr-10','profilin','ltp']); -- apio (Api g 1/4 + Api g 2 LTP)
SELECT pg_temp.merge_allergen_tags('alg_0181', ARRAY['pr-10','profilin']);        -- zanahoria (Dau c 1/4)
SELECT pg_temp.merge_allergen_tags('alg_0196', ARRAY['profilin']);                -- perejil

-- Soy — pr-10 (Gly m 4) + profilin (Gly m 3)
SELECT pg_temp.merge_allergen_tags('alg_0172', ARRAY['pr-10','profilin']);

-- Hazelnut (Corylus avellana, food) — pr-10 + profilin + ltp (Cor a 1/2/8)
SELECT pg_temp.merge_allergen_tags('alg_0146', ARRAY['pr-10','profilin','ltp']);

-- Other tree nuts — ltp (+ profilin where documented)
SELECT pg_temp.merge_allergen_tags('alg_0145', ARRAY['ltp']);                    -- almendra (Pru du 3)
SELECT pg_temp.merge_allergen_tags('alg_0147', ARRAY['profilin','ltp']);         -- maní (Ara h 5 + Ara h 9)
SELECT pg_temp.merge_allergen_tags('alg_0148', ARRAY['profilin','ltp']);         -- castaña (Cas s 2 + Cas s 8)
SELECT pg_temp.merge_allergen_tags('alg_0151', ARRAY['profilin','ltp']);         -- nuez nogal (Jug r 7 + Jug r 3)
SELECT pg_temp.merge_allergen_tags('alg_0153', ARRAY['profilin','ltp']);         -- pipa girasol (Hel a 2 + Hel a 3)
SELECT pg_temp.merge_allergen_tags('alg_0154', ARRAY['profilin']);               -- pistacho

-- Cereals (food) — profilin + ltp where major
SELECT pg_temp.merge_allergen_tags('alg_0182', ARRAY['profilin','ltp']); -- arroz (Ory s 12 + Ory s 14)
SELECT pg_temp.merge_allergen_tags('alg_0184', ARRAY['profilin','ltp']); -- trigo (Tri a 12 + Tri a 14)
SELECT pg_temp.merge_allergen_tags('alg_0186', ARRAY['profilin','ltp']); -- harina avena
SELECT pg_temp.merge_allergen_tags('alg_0187', ARRAY['profilin','ltp']); -- harina cebada
SELECT pg_temp.merge_allergen_tags('alg_0188', ARRAY['profilin','ltp']); -- harina centeno

-- Solanaceae food — profilin (pimiento, patata)
SELECT pg_temp.merge_allergen_tags('alg_0177', ARRAY['profilin']);      -- patata
SELECT pg_temp.merge_allergen_tags('alg_0178', ARRAY['profilin']);      -- pimiento

-- Cucurbitaceae + melon-like — profilin
SELECT pg_temp.merge_allergen_tags('alg_0163', ARRAY['profilin']);      -- melón
SELECT pg_temp.merge_allergen_tags('alg_0168', ARRAY['profilin']);      -- sandía

-- Citrus — profilin (+ ltp for orange Cit s 3)
SELECT pg_temp.merge_allergen_tags('alg_0159', ARRAY['profilin']);          -- limón
SELECT pg_temp.merge_allergen_tags('alg_0160', ARRAY['profilin']);          -- mandarina
SELECT pg_temp.merge_allergen_tags('alg_0164', ARRAY['profilin','ltp']);    -- naranja (Cit s 3)
SELECT pg_temp.merge_allergen_tags('alg_0167', ARRAY['profilin']);          -- pomelo
SELECT pg_temp.merge_allergen_tags('alg_0209', ARRAY['profilin','ltp']);    -- cítricos mix

-- Banana — profilin (cross-reactive with latex)
SELECT pg_temp.merge_allergen_tags('alg_0166', ARRAY['profilin']);

-- Avocado — profilin (latex-fruit syndrome)
SELECT pg_temp.merge_allergen_tags('alg_0165', ARRAY['profilin']);

-- Beetroot — profilin (Amaranthaceae cross-reactive)
SELECT pg_temp.merge_allergen_tags('alg_0179', ARRAY['profilin']);

-- Mustard — profilin + ltp (Sin a 3 / Sin a 4)
SELECT pg_temp.merge_allergen_tags('alg_0194', ARRAY['profilin','ltp']);

-- Latex (Hevea) — Hev b 8 profilin + Hev b 12 LTP
SELECT pg_temp.merge_allergen_tags('alg_0115', ARRAY['profilin','ltp']);

-- Molecular components — self-tags
SELECT pg_temp.merge_allergen_tags('alg_0203', ARRAY['ltp']);       -- LTP component
SELECT pg_temp.merge_allergen_tags('alg_0204', ARRAY['profilin']);  -- Profilin component

DROP FUNCTION pg_temp.merge_allergen_tags(TEXT, TEXT[]);
