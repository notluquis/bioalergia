-- Job Radar — Gold Fields (SF Classic, multi-país LatAm/global, 70 ofertas).
-- Validado en vivo 2026-06-24 (incluye Perú/global, no solo Chile — a pedido).
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'SFCLASSIC', 'career5.successfactors.eu:career:C0008741144P:es_ES', 'Gold Fields', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
