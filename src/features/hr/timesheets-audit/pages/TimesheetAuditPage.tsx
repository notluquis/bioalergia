/**
 * Timesheet Audit Page (Redesigned)
 * A more ergonomic, user-friendly interface for auditing employee schedules
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/es";
import { Calendar, Users, AlertTriangle, ChevronDown, ChevronUp, Search, X, Check } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import Alert from "@/components/ui/Alert";
import { fetchEmployees } from "@/features/hr/employees/api";
import type { Employee } from "@/features/hr/employees/types";
import { TimesheetAuditCalendar } from "@/features/hr/timesheets-audit/components";
import { detectAllOverlaps } from "@/features/hr/timesheets-audit/utils/overlapDetection";
import { useMonths } from "@/features/hr/timesheets/hooks/useMonths";
import { useTimesheetAudit, type AuditDateRange } from "@/features/hr/timesheets-audit/hooks/useTimesheetAudit";

dayjs.extend(isoWeek);
dayjs.locale("es");

type WeekDefinition = {
  key: string;
  month: string;
  number: number;
  label: string;
  start: string;
  end: string;
};

type QuickRange = "this-week" | "last-week" | "this-month" | "last-month" | "two-months-ago" | "custom";

const QUICK_RANGES: { id: QuickRange; label: string }[] = [
  { id: "this-week", label: "Esta semana" },
  { id: "last-week", label: "Semana pasada" },
  { id: "this-month", label: "Este mes" },
  { id: "last-month", label: "Mes pasado" },
  { id: "two-months-ago", label: "Mes antepasado" },
  { id: "custom", label: "Personalizado" },
];

const MAX_EMPLOYEES = 5;

function buildWeeksForMonth(month: string): WeekDefinition[] {
  const baseDate = dayjs(`${month}-01`);
  const monthStart = baseDate.startOf("month");
  const monthEnd = baseDate.endOf("month");

  const weeks: WeekDefinition[] = [];
  const seen = new Set<number>();
  let cursor = monthStart.startOf("isoWeek");

  while (cursor.isBefore(monthEnd) || cursor.isSame(monthEnd, "day")) {
    const weekNumber = cursor.isoWeek();
    if (!seen.has(weekNumber)) {
      const weekStart = cursor.startOf("isoWeek");
      const weekEnd = cursor.endOf("isoWeek");
      const clampedStart = weekStart.isBefore(monthStart) ? monthStart : weekStart;
      const clampedEnd = weekEnd.isAfter(monthEnd) ? monthEnd : weekEnd;
      weeks.push({
        key: `${month}:${weekNumber}`,
        month,
        number: weekNumber,
        label: `S${weekNumber} (${clampedStart.format("D")} - ${clampedEnd.format("D MMM")})`,
        start: clampedStart.format("YYYY-MM-DD"),
        end: clampedEnd.format("YYYY-MM-DD"),
      });
      seen.add(weekNumber);
    }
    cursor = cursor.add(1, "week");
  }

  return weeks;
}

function getQuickRangeValues(range: QuickRange): { start: string; end: string } | null {
  const today = dayjs();
  switch (range) {
    case "this-week":
      return {
        start: today.startOf("isoWeek").format("YYYY-MM-DD"),
        end: today.endOf("isoWeek").format("YYYY-MM-DD"),
      };
    case "last-week":
      return {
        start: today.subtract(1, "week").startOf("isoWeek").format("YYYY-MM-DD"),
        end: today.subtract(1, "week").endOf("isoWeek").format("YYYY-MM-DD"),
      };
    case "this-month":
      return {
        start: today.startOf("month").format("YYYY-MM-DD"),
        end: today.endOf("month").format("YYYY-MM-DD"),
      };
    case "last-month":
      return {
        start: today.subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
        end: today.subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
      };
    case "two-months-ago":
      return {
        start: today.subtract(2, "month").startOf("month").format("YYYY-MM-DD"),
        end: today.subtract(2, "month").endOf("month").format("YYYY-MM-DD"),
      };
    default:
      return null;
  }
}

export default function TimesheetAuditPage() {
  useAuth();

  // Data state
  const { months, loading: loadingMonths } = useMonths();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Selection state
  const [quickRange, setQuickRange] = useState<QuickRange>("last-week");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);

  // UI state
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Build weeks for the selected month
  const weeksForMonth = useMemo(() => {
    if (!selectedMonth) return [];
    return buildWeeksForMonth(selectedMonth);
  }, [selectedMonth]);

  // Active employees with search
  const activeEmployees = useMemo(() => employees.filter((emp) => emp.status === "ACTIVE"), [employees]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return activeEmployees;
    const search = employeeSearch.toLowerCase();
    return activeEmployees.filter((emp) => emp.full_name.toLowerCase().includes(search));
  }, [activeEmployees, employeeSearch]);

  // Load employees
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

  // Set default month when months load
  useEffect(() => {
    if (months.length && !selectedMonth) {
      const prevMonth = dayjs().subtract(1, "month").format("YYYY-MM");
      setSelectedMonth(months.includes(prevMonth) ? prevMonth : (months[0] ?? ""));
    }
  }, [months, selectedMonth]);

  // Calculate effective date ranges based on quick range or custom selection
  const effectiveRanges = useMemo((): AuditDateRange[] => {
    if (quickRange !== "custom") {
      const range = getQuickRangeValues(quickRange);
      return range ? [range] : [];
    }

    // Custom: use selected weeks
    if (!selectedWeekKeys.length || !selectedMonth) return [];

    return selectedWeekKeys
      .map((key) => {
        const week = weeksForMonth.find((w) => w.key === key);
        return week ? { start: week.start, end: week.end } : null;
      })
      .filter((r): r is AuditDateRange => r !== null);
  }, [quickRange, selectedWeekKeys, selectedMonth, weeksForMonth]);

  const focusDate = effectiveRanges[0]?.start ?? null;

  // Fetch audit data
  const {
    entries,
    loading: loadingEntries,
    error: errorEntries,
  } = useTimesheetAudit({
    ranges: effectiveRanges,
    employeeIds: selectedEmployeeIds,
  });

  // Calculate overlaps
  const overlapsByDate = useMemo(() => detectAllOverlaps(entries), [entries]);
  const totalOverlapDays = overlapsByDate.size;
  const totalOverlapPairs = Array.from(overlapsByDate.values()).reduce(
    (sum, info) => sum + info.total_overlapping_pairs,
    0
  );

  // Handlers
  const handleQuickRangeChange = useCallback((range: QuickRange) => {
    setQuickRange(range);
  }, []);

  const handleWeekToggle = useCallback((key: string) => {
    setSelectedWeekKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }, []);

  const handleSelectAllWeeks = useCallback(() => {
    setSelectedWeekKeys((prev) => {
      const allKeys = weeksForMonth.map((w) => w.key);
      const allSelected = allKeys.every((k) => prev.includes(k));
      return allSelected ? [] : allKeys;
    });
  }, [weeksForMonth]);

  const handleEmployeeToggle = useCallback((employeeId: number) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      }
      if (prev.length >= MAX_EMPLOYEES) return prev;
      return [...prev, employeeId];
    });
  }, []);

  const handleRemoveEmployee = useCallback((employeeId: number) => {
    setSelectedEmployeeIds((prev) => prev.filter((id) => id !== employeeId));
  }, []);

  const handleClearEmployees = useCallback(() => {
    setSelectedEmployeeIds([]);
  }, []);

  // Format range summary
  const rangeSummary = useMemo(() => {
    if (!effectiveRanges.length) return "";
    const first = dayjs(effectiveRanges[0]?.start);
    const last = dayjs(effectiveRanges[effectiveRanges.length - 1]?.end);
    return `${first.format("D MMM")} → ${last.format("D MMM YYYY")}`;
  }, [effectiveRanges]);

  const isMaxEmployees = selectedEmployeeIds.length >= MAX_EMPLOYEES;
  const canShowCalendar = selectedEmployeeIds.length > 0 && effectiveRanges.length > 0;

  return (
    <section className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="typ-title text-base-content">Auditoría de horarios</h1>
        <p className="mt-1 text-sm text-base-content/60">Detecta solapamientos de turnos entre empleados</p>
      </header>

      {/* Compact Filters */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4 space-y-4">
          {/* Quick Range Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-base-content/70">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Periodo:</span>
            </div>
            <div className="join">
              {QUICK_RANGES.map((range) => (
                <button
                  key={range.id}
                  type="button"
                  className={`join-item btn btn-sm ${quickRange === range.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => handleQuickRangeChange(range.id)}
                >
                  {range.label}
                </button>
              ))}
            </div>
            {rangeSummary && <span className="text-xs text-base-content/50 hidden sm:inline">({rangeSummary})</span>}
          </div>

          {/* Custom Week Picker (collapsible) */}
          {quickRange === "custom" && (
            <div className="border-t border-base-200 pt-4 space-y-3">
              <div className="flex items-center gap-4">
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setSelectedWeekKeys([]);
                  }}
                  className="select select-bordered select-sm w-48"
                  disabled={loadingMonths}
                >
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {dayjs(`${month}-01`).format("MMMM YYYY")}
                    </option>
                  ))}
                </select>
                {weeksForMonth.length > 0 && (
                  <button type="button" onClick={handleSelectAllWeeks} className="link link-primary text-sm">
                    {selectedWeekKeys.length === weeksForMonth.length ? "Quitar todas" : "Todas las semanas"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {weeksForMonth.map((week) => {
                  const isActive = selectedWeekKeys.includes(week.key);
                  return (
                    <button
                      key={week.key}
                      type="button"
                      className={`badge badge-lg cursor-pointer transition-all ${
                        isActive ? "badge-primary" : "badge-ghost border-base-300 hover:border-primary/50"
                      }`}
                      onClick={() => handleWeekToggle(week.key)}
                    >
                      {week.label}
                    </button>
                  );
                })}
              </div>
              {selectedWeekKeys.length === 0 && <p className="text-xs text-warning">Selecciona al menos una semana</p>}
            </div>
          )}

          {/* Employee Selector */}
          <div className="border-t border-base-200 pt-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex items-center gap-2 text-sm text-base-content/70">
                <Users className="h-4 w-4" />
                <span className="font-medium">Empleados:</span>
                <span className="badge badge-sm badge-ghost">
                  {selectedEmployeeIds.length}/{MAX_EMPLOYEES}
                </span>
              </div>

              {/* Selected Employees Pills */}
              <div className="flex flex-wrap gap-2 flex-1">
                {selectedEmployeeIds.map((id) => {
                  const emp = activeEmployees.find((e) => e.id === id);
                  if (!emp) return null;
                  return (
                    <div key={id} className="badge badge-primary gap-1 pr-1">
                      <span className="max-w-32 truncate">{emp.full_name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmployee(id)}
                        className="btn btn-ghost btn-xs btn-circle"
                        aria-label={`Quitar ${emp.full_name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Add Employee Dropdown */}
                {!isMaxEmployees && (
                  <div className="dropdown dropdown-bottom">
                    <button
                      type="button"
                      tabIndex={0}
                      className="badge badge-ghost border-dashed border-base-300 gap-1 cursor-pointer hover:border-primary/50"
                      onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                    >
                      + Agregar
                      {showEmployeeDropdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showEmployeeDropdown && (
                      <div
                        tabIndex={0}
                        className="dropdown-content z-50 mt-2 w-72 rounded-box bg-base-100 shadow-xl border border-base-200"
                      >
                        {/* Search */}
                        <div className="p-2 border-b border-base-200">
                          <label className="input input-bordered input-sm flex items-center gap-2 w-full">
                            <Search className="h-4 w-4 text-base-content/50" />
                            <input
                              type="text"
                              placeholder="Buscar empleado..."
                              value={employeeSearch}
                              onChange={(e) => setEmployeeSearch(e.target.value)}
                              className="grow bg-transparent outline-none"
                            />
                          </label>
                        </div>

                        {/* Employee List */}
                        <ul className="menu menu-sm max-h-60 overflow-y-auto flex-nowrap p-2">
                          {loadingEmployees ? (
                            <li className="p-4 text-center">
                              <span className="loading loading-spinner loading-sm" />
                            </li>
                          ) : filteredEmployees.length === 0 ? (
                            <li className="p-4 text-center text-sm text-base-content/50">
                              No se encontraron empleados
                            </li>
                          ) : (
                            filteredEmployees.map((emp) => {
                              const isSelected = selectedEmployeeIds.includes(emp.id);
                              return (
                                <li key={emp.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleEmployeeToggle(emp.id);
                                      if (!isSelected && selectedEmployeeIds.length + 1 >= MAX_EMPLOYEES) {
                                        setShowEmployeeDropdown(false);
                                      }
                                    }}
                                    className={`flex justify-between ${isSelected ? "active" : ""}`}
                                  >
                                    <span className="truncate">{emp.full_name}</span>
                                    {isSelected && <Check className="h-4 w-4" />}
                                  </button>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {selectedEmployeeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearEmployees}
                    className="badge badge-ghost text-error gap-1 cursor-pointer hover:bg-error/10"
                  >
                    <X className="h-3 w-3" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {selectedEmployeeIds.length === 0 && (
              <p className="mt-2 text-xs text-warning">Selecciona al menos 1 empleado para ver la auditoría</p>
            )}

            {isMaxEmployees && (
              <p className="mt-2 text-xs text-base-content/50">Máximo {MAX_EMPLOYEES} empleados simultáneos</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row (compact) */}
      {canShowCalendar && (
        <div className="flex flex-wrap gap-4">
          <div className="stat bg-base-100 shadow-sm rounded-box flex-1 min-w-32 py-3 px-4">
            <div className="stat-title text-xs">Periodos</div>
            <div className="stat-value text-lg text-primary">{effectiveRanges.length}</div>
          </div>
          <div className="stat bg-base-100 shadow-sm rounded-box flex-1 min-w-32 py-3 px-4">
            <div className="stat-title text-xs">Registros</div>
            <div className="stat-value text-lg">{entries.length}</div>
          </div>
          <div className="stat bg-base-100 shadow-sm rounded-box flex-1 min-w-32 py-3 px-4">
            <div className="stat-title text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Días con alertas
            </div>
            <div className={`stat-value text-lg ${totalOverlapDays > 0 ? "text-warning" : "text-success"}`}>
              {totalOverlapDays}
            </div>
          </div>
          <div className="stat bg-base-100 shadow-sm rounded-box flex-1 min-w-32 py-3 px-4">
            <div className="stat-title text-xs">Conflictos</div>
            <div className={`stat-value text-lg ${totalOverlapPairs > 0 ? "text-error" : "text-success"}`}>
              {totalOverlapPairs}
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {errorEntries && <Alert variant="error">{errorEntries}</Alert>}

      {/* Empty States */}
      {selectedEmployeeIds.length === 0 ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body items-center text-center py-16">
            <Users className="h-12 w-12 text-base-content/30 mb-4" />
            <h3 className="text-lg font-semibold text-base-content/70">Selecciona empleados</h3>
            <p className="text-sm text-base-content/50 max-w-md">
              Elige hasta {MAX_EMPLOYEES} empleados para analizar sus horarios y detectar solapamientos
            </p>
          </div>
        </div>
      ) : !loadingEntries && entries.length === 0 ? (
        <Alert variant="warning">No hay registros para el periodo seleccionado. Prueba con otro rango de fechas.</Alert>
      ) : null}

      {/* Calendar */}
      {canShowCalendar && (
        <TimesheetAuditCalendar
          entries={entries}
          loading={loadingEntries}
          selectedEmployeeIds={selectedEmployeeIds}
          focusDate={focusDate}
          visibleDateRanges={effectiveRanges}
        />
      )}

      {/* Legend (collapsible) */}
      {canShowCalendar && entries.length > 0 && (
        <details className="collapse collapse-arrow bg-base-100 shadow-sm">
          <summary className="collapse-title text-sm font-medium">Guía de interpretación</summary>
          <div className="collapse-content">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm pt-2">
              <div className="flex items-start gap-2">
                <div className="h-4 w-4 rounded bg-accent shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Sin conflicto</p>
                  <p className="text-xs text-base-content/60">Turnos sin solapamiento</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-4 w-4 rounded bg-error shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Conflicto</p>
                  <p className="text-xs text-base-content/60">Horarios traslapados</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">👩‍⚕️</span>
                <div>
                  <p className="font-medium">Compatibles</p>
                  <p className="text-xs text-base-content/60">Enfermero + TENS pueden coexistir</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">⌛</span>
                <div>
                  <p className="font-medium">Tooltip</p>
                  <p className="text-xs text-base-content/60">Pasa el cursor para detalles</p>
                </div>
              </div>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}
