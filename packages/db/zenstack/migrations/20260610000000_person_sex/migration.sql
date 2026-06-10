-- Sexo registral del paciente (M|F|X) — requisito receta médica (Art. 101).
-- Aditivo + idempotente.
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "sex" VARCHAR(1);
