-- Job Radar — nuevo ATS: Computrabajo (cl.computrabajo.com), el agregador de
-- empleo más grande de Chile. Adapter: modules/job-radar/computrabajo.ts.
-- ADD VALUE va en su propia migración: Postgres no permite USAR un valor de enum
-- nuevo en la misma transacción donde se agrega (el seed va en la migración
-- siguiente 20260623002000).
ALTER TYPE "personal"."JobSourceKind" ADD VALUE IF NOT EXISTS 'COMPUTRABAJO';
