/**
 * Timesheet Audit Page
 * Dedicated page for auditing employee work schedules and detecting overlaps
 */

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";

import { useAuth } from "../context/AuthContext";
import Alert from "../components/Alert";
import { fetchEmployees } from "../features/employees/api";
import type { Employee } from "../features/employees/types";
import { TimesheetAuditCalendar, EmployeeAuditSelector } from "../features/timesheets-audit/components";
import { useTimesheetAudit } from "../features/timesheets-audit/hooks/useTimesheetAudit";
import { detectAllOverlaps } from "../features/timesheets-audit/utils/overlapDetection";
import { useMonths } from "../features/timesheets/hooks/useMonths";

dayjs.locale("es");

export default function TimesheetAuditPage() {
  useAuth(); // Ensure auth

  const { months, loading: loadingMonths } = useMonths();
  const [month, setMonth] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const {
    entries,
    loading: loadingEntries,
    error: errorEntries,
  } = useTimesheetAudit({
    month,
    employeeIds: selectedEmployeeIds,
  });

  // Load employees on mount
  useEffect(() => {
    async function loadEmployees() {
      try {
        const data = await fetchEmployees(false);
        setEmployees(data);
      } catch (err) {
        console.error("Error loading employees:", err);
      } finally {
        setLoadingEmployees(false);
      }
    }

    loadEmployees();
  }, []);

  // Set initial month (previous month) when months are loaded
  useEffect(() => {
    if (months.length && !month) {
      const previousMonth = dayjs().subtract(1, "month").format("YYYY-MM");
      const hasMonth = months.includes(previousMonth);
      setMonth(hasMonth ? previousMonth : months[0] || "");
    }
  }, [months, month]);

  const monthLabel = month ? dayjs(month + "-01").format("MMMM YYYY") : "";

  // Detect overlaps for display
  const overlapsByDate = detectAllOverlaps(entries);
  const totalOverlapDays = overlapsByDate.size;
  const totalOverlapPairs = Array.from(overlapsByDate.values()).reduce(
    (sum, info) => sum + info.total_overlapping_pairs,
    0
  );

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-primary">Auditoría de horarios</h1>
        <p className="max-w-2xl text-sm text-base-content/70">
          Visualiza y audita los horarios de trabajo de múltiples empleados simultáneamente. Identifica solapamientos y
          conflictos de asignación fácilmente.
        </p>
      </div>

      {/* Controls */}
      <div className="grid gap-4 rounded-2xl border border-primary/15 bg-base-100 p-6 shadow-sm md:grid-cols-2 lg:grid-cols-3">
        {/* Period Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-base-content/80">Período</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="select select-bordered select-sm"
            disabled={loadingMonths}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {dayjs(m + "-01").format("MMMM YYYY")}
              </option>
            ))}
          </select>
        </div>

        {/* Employee Selector */}
        <div className="md:col-span-2 lg:col-span-2">
          {!loadingEmployees && (
            <EmployeeAuditSelector
              employees={employees}
              selectedIds={selectedEmployeeIds}
              onSelectionChange={setSelectedEmployeeIds}
              loading={loadingEntries}
            />
          )}
        </div>
      </div>

      {/* Statistics */}
      {selectedEmployeeIds.length > 0 && entries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Empleados auditando
            </div>
            <div className="mt-2 text-2xl font-bold text-primary">{selectedEmployeeIds.length}</div>
          </div>

          <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Días con solapamiento
            </div>
            <div className="mt-2 text-2xl font-bold text-warning">{totalOverlapDays}</div>
          </div>

          <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Pares en conflicto</div>
            <div className="mt-2 text-2xl font-bold text-error">{totalOverlapPairs}</div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {errorEntries && <Alert variant="error">{errorEntries}</Alert>}

      {selectedEmployeeIds.length === 0 && (
        <Alert variant="error">Selecciona al menos 1 empleado para ver la auditoría</Alert>
      )}

      {selectedEmployeeIds.length > 0 && entries.length === 0 && !loadingEntries && (
        <Alert variant="error">No hay registros de tiempo para los empleados seleccionados en {monthLabel}</Alert>
      )}

      {/* Calendar */}
      {selectedEmployeeIds.length > 0 && (
        <TimesheetAuditCalendar entries={entries} loading={loadingEntries} selectedEmployeeIds={selectedEmployeeIds} />
      )}

      {/* Legend */}
      {selectedEmployeeIds.length > 0 && entries.length > 0 && (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-base-content">Guía de lectura</h3>
          <ul className="space-y-3 text-sm text-base-content/70">
            <li className="flex gap-3">
              <span className="font-semibold text-base-content">📅 Vista mes/semana/día:</span>
              Navega entre vistas para analizar los horarios en diferentes niveles de detalle.
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-base-content">🎨 Código de colores:</span>
              <span>
                <strong className="text-accent">Verde:</strong> Sin solapamiento
                <strong className="ml-2 text-error">Rojo:</strong> Solapamiento detectado
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-base-content">⏱️ Información al pasar mouse:</span>
              Nombre del empleado, duración exacta y estado de solapamiento.
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-base-content">📊 Estadísticas:</span>
              Números en la parte superior muestran días con conflictos y pares en solapamiento.
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
