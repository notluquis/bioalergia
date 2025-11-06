/**
 * Timesheet Audit Page
 * Dedicated page for auditing employee work schedules and detecting overlaps
 */

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/es";

import { useAuth } from "../context/AuthContext";
import Alert from "../components/Alert";
import { fetchEmployees } from "../features/employees/api";
import type { Employee } from "../features/employees/types";
import { TimesheetAuditCalendar, EmployeeAuditSelector } from "../features/timesheets-audit/components";
import { useTimesheetAudit } from "../features/timesheets-audit/hooks/useTimesheetAudit";
import { detectAllOverlaps } from "../features/timesheets-audit/utils/overlapDetection";
import { useMonths } from "../features/timesheets/hooks/useMonths";

dayjs.extend(isoWeek);
dayjs.locale("es");

export default function TimesheetAuditPage() {
  useAuth(); // Ensure auth

  const { months, loading: loadingMonths } = useMonths();
  const [month, setMonth] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
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

  // Calculate available weeks for the selected month
  const weeksInMonth = useMemo(() => {
    if (!month) return [];

    const [year, monthNum] = month.split("-");
    const firstDay = dayjs(`${year}-${monthNum}-01`);
    const lastDay = firstDay.endOf("month");

    const weeks: Array<{ number: number; startDate: string; endDate: string }> = [];
    let currentDay = firstDay;

    while (currentDay.isBefore(lastDay) || currentDay.isSame(lastDay, "day")) {
      const weekNumber = currentDay.isoWeek();
      const weekStart = currentDay.startOf("isoWeek");
      const weekEnd = currentDay.endOf("isoWeek");

      // Only add weeks that have days in the current month
      if (!weeks.some((w) => w.number === weekNumber)) {
        weeks.push({
          number: weekNumber,
          startDate: weekStart.format("YYYY-MM-DD"),
          endDate: weekEnd.format("YYYY-MM-DD"),
        });
      }

      currentDay = currentDay.add(1, "day");
    }

    return weeks;
  }, [month]);

  // Set default week to first week of month
  useEffect(() => {
    if (selectedWeek === null && weeksInMonth.length > 0 && weeksInMonth[0]) {
      setSelectedWeek(weeksInMonth[0].number);
    }
  }, [weeksInMonth, selectedWeek]);

  const monthLabel = month ? dayjs(month + "-01").format("MMMM YYYY") : "";
  const selectedWeekInfo = weeksInMonth.find((w) => w.number === selectedWeek);

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

      {/* Period and Week Selection */}
      <div className="grid gap-4 rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-base-content/80">Mes</label>
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setSelectedWeek(null);
            }}
            className="select select-bordered select-sm text-sm"
            disabled={loadingMonths}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {dayjs(m + "-01").format("MMMM YYYY")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-base-content/80">Semana</label>
          <select
            value={selectedWeek || ""}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="select select-bordered select-sm text-sm"
            disabled={weeksInMonth.length === 0}
          >
            {weeksInMonth.map((week) => {
              const startDate = dayjs(week.startDate).format("D MMM");
              const endDate = dayjs(week.endDate).format("D MMM");
              return (
                <option key={week.number} value={week.number}>
                  Semana {week.number} ({startDate} - {endDate})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Employee Selection */}
      {!loadingEmployees && (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
          <EmployeeAuditSelector
            employees={employees}
            selectedIds={selectedEmployeeIds}
            onSelectionChange={setSelectedEmployeeIds}
            loading={loadingEntries}
          />
        </div>
      )}

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
        <>
          {selectedWeekInfo && (
            <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
              <p className="text-sm font-medium text-base-content">
                Semana {selectedWeekInfo.number}: {dayjs(selectedWeekInfo.startDate).format("D MMMM")} -{" "}
                {dayjs(selectedWeekInfo.endDate).format("D MMMM YYYY")}
              </p>
            </div>
          )}
          <TimesheetAuditCalendar
            entries={entries}
            loading={loadingEntries}
            selectedEmployeeIds={selectedEmployeeIds}
          />
        </>
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
