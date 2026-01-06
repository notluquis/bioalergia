-- Migración para ajustar offsets de timezone en employee_timesheets
-- Los tiempos están guardados con +6 horas de offset
-- Necesitamos restarlas para obtener los valores correctos en America/Santiago

-- Ajustar start_time restando 6 horas
UPDATE employee_timesheets
SET start_time = (start_time::time - interval '6 hours')::time
WHERE start_time IS NOT NULL;

-- Ajustar end_time restando 6 horas
UPDATE employee_timesheets
SET end_time = (end_time::time - interval '6 hours')::time
WHERE end_time IS NOT NULL;

-- Verificar los cambios
SELECT 
  work_date,
  start_time,
  end_time,
  worked_minutes
FROM employee_timesheets
ORDER BY work_date DESC
LIMIT 10;
