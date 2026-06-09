-- Seed Cornerstone CL (verificado en vivo). Va DESPUÉS del enum add.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'CORNERSTONE', 'cencosud:5', 'Cencosud (Jumbo/Paris/Easy)', true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
