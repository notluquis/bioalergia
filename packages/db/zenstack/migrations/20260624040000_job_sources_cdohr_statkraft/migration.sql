-- Job Radar — ENAMI (CDOHR, 154 ofertas con descripción) + Statkraft (SmartRecruiters
-- companyId case-sensitive "Statkraft1"). Validadas en vivo 2026-06-24.
INSERT INTO "personal"."job_sources" ("id", "kind", "identifier", "label", "enabled") VALUES
  (gen_random_uuid()::text, 'CDOHR',           'enami',      'ENAMI (Empresa Nacional de Minería)', true),
  (gen_random_uuid()::text, 'SMARTRECRUITERS', 'Statkraft1', 'Statkraft Chile',                     true)
ON CONFLICT ("kind", "identifier") DO NOTHING;
