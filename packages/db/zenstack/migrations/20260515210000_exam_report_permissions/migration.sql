-- Seed permissions for the exam-reports feature so existing role admin
-- UI can wire them to TENS / Enfermero / Médico per the POE-ALG-TC-001
-- responsibilities (§3):
--   * TENS:       only `read ExamReport` (puede ver / descargar)
--   * Enfermero:  read + create + update on ExamReport (ejecuta + registra)
--   * Médico:     read + create + update + delete on ExamReport (interpreta + firma)
-- Plus admin-only manage on ConclusionTemplate + ClinicSettings.
-- Idempotent: ON CONFLICT DO NOTHING; touches no role assignments.

INSERT INTO permissions (action, subject, description, created_at, updated_at)
VALUES
  ('read',   'ExamReport', 'Ver informes de exámenes y descargar PDF', now(), now()),
  ('create', 'ExamReport', 'Crear nuevos informes de exámenes', now(), now()),
  ('update', 'ExamReport', 'Editar informes de exámenes existentes', now(), now()),
  ('delete', 'ExamReport', 'Eliminar informes de exámenes', now(), now()),
  ('read',   'ConclusionTemplate', 'Ver plantillas de conclusión', now(), now()),
  ('create', 'ConclusionTemplate', 'Crear plantillas de conclusión', now(), now()),
  ('update', 'ConclusionTemplate', 'Editar plantillas de conclusión', now(), now()),
  ('delete', 'ConclusionTemplate', 'Eliminar plantillas de conclusión', now(), now()),
  ('read',   'ClinicSettings', 'Ver configuración de la clínica', now(), now()),
  ('update', 'ClinicSettings', 'Editar configuración de la clínica', now(), now())
ON CONFLICT (action, subject) DO NOTHING;
