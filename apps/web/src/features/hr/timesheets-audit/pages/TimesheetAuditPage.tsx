/**
 * Timesheet Audit Page (Redesigned)
 * A more ergonomic, user-friendly interface for auditing employee schedules
 */

import "dayjs/locale/es";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { Check, ChevronDown, ChevronUp, Search, Users, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import Alert from "@/components/ui/Alert";
import Backdrop from "@/components/ui/Backdrop";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
import { useAuth } from "@/context/AuthContext";
import { fetchEmployees } from "@/features/hr/employees/api";
import { useMonths } from "@/features/hr/timesheets/hooks/useMonths";
import { type AuditDateRange, useTimesheetAudit } from "@/features/hr/timesheets-audit/hooks/useTimesheetAudit";
import { detectAllOverlaps } from "@/features/hr/timesheets-audit/utils/overlapDetection";
import { endOfMonth, monthsAgoEnd, monthsAgoStart, startOfMonth } from "@/lib/dates";
import { INPUT_SEARCH_SM, LOADING_SPINNER_SM } from "@/lib/styles";
import { cn } from "@/lib/utils";

const TimesheetAuditCalendar = lazy(() => import("@/features/hr/timesheets-audit/components/TimesheetAuditCalendar"));

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
        start: startOfMonth(),
        end: endOfMonth(),
      };
    case "last-month":
      return {
        start: monthsAgoStart(1),
        end: monthsAgoEnd(1),
      };
    case "two-months-ago":
      return {
        start: monthsAgoStart(2),
        end: monthsAgoEnd(2),
      };
    default:
      return null;
  }
}

export default function TimesheetAuditPage() {
  useAuth();

  // Data state
  const { months, loading: loadingMonths } = useMonths();

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees", "active-only"], // We might want to be specific if we change the fetch param later
    queryFn: () => fetchEmployees(false),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Selection state
  const [quickRange, setQuickRange] = useState<QuickRange>("last-week");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);

  // UI state
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [customWeeksOpen, setCustomWeeksOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);

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
        <h1 className="text-primary text-2xl font-bold">Auditoría de horarios</h1>
        <p className="text-base-content/70 mt-1 text-sm">
          Detecta solapamientos de turnos entre empleados y analiza conflictos de programación
        </p>
      </header>

      {/* Step 1: Period Selection */}
      <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="badge badge-lg badge-primary">1</div>
          <h2 className="text-base-content text-lg font-semibold">Selecciona el periodo</h2>
          {rangeSummary && <span className="text-base-content/60 ml-auto text-sm">({rangeSummary})</span>}
        </div>

        {/* Quick Range Buttons */}
        <div className="flex flex-wrap gap-2">
          {QUICK_RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              className={`btn btn-sm ${quickRange === range.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => handleQuickRangeChange(range.id)}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Custom Week Picker (collapsible) */}
        {quickRange === "custom" && (
          <div className="bg-base-200/50 mt-4 rounded-xl">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left font-medium select-none"
              onClick={() => setCustomWeeksOpen(!customWeeksOpen)}
            >
              <span>Personalizar semanas específicas</span>
              <ChevronDown
                size={16}
                className={cn("transform transition-transform duration-300", customWeeksOpen && "rotate-180")}
              />
            </button>
            <SmoothCollapse isOpen={customWeeksOpen}>
              <div className="space-y-4 px-4 pt-0 pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      setSelectedWeekKeys([]);
                    }}
                    className="select select-bordered select-sm max-w-xs flex-1"
                    disabled={loadingMonths}
                  >
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {dayjs(`${month}-01`).format("MMMM YYYY")}
                      </option>
                    ))}
                  </select>
                  {weeksForMonth.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllWeeks}
                      className="link link-primary text-sm whitespace-nowrap"
                    >
                      {selectedWeekKeys.length === weeksForMonth.length ? "Deseleccionar todas" : "Seleccionar todas"}
                    </button>
                  )}
                </div>

                {/* Weeks Grid */}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {weeksForMonth.map((week) => {
                    const isActive = selectedWeekKeys.includes(week.key);
                    return (
                      <button
                        key={week.key}
                        type="button"
                        onClick={() => handleWeekToggle(week.key)}
                        className={`rounded-lg border p-3 text-left transition-all ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-base-300 bg-base-100 text-base-content hover:border-primary/50"
                        }`}
                      >
                        <div className="text-sm font-medium">{week.label}</div>
                      </button>
                    );
                  })}
                </div>

                {selectedWeekKeys.length === 0 && (
                  <p className="text-warning text-sm">Selecciona al menos una semana</p>
                )}
              </div>
            </SmoothCollapse>
          </div>
        )}
      </div>

      {/* Step 2: Employee Selection */}
      <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="badge badge-lg badge-primary">2</div>
          <h2 className="text-base-content text-lg font-semibold">Selecciona empleados</h2>
          <span className="text-base-content/60 ml-auto text-sm">
            {selectedEmployeeIds.length}/{MAX_EMPLOYEES}
          </span>
        </div>

        {/* Selected Employees */}
        {selectedEmployeeIds.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {selectedEmployeeIds.map((id) => {
              const emp = activeEmployees.find((e) => e.id === id);
              if (!emp) return null;
              return (
                <div key={id} className="badge badge-primary gap-2 px-3 py-2">
                  <span>{emp.full_name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmployee(id)}
                    className="btn btn-ghost btn-xs h-5 w-5 p-0"
                    aria-label={`Quitar ${emp.full_name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            {selectedEmployeeIds.length > 0 && (
              <button type="button" onClick={handleClearEmployees} className="link link-error text-sm">
                Limpiar todos
              </button>
            )}
          </div>
        )}

        {/* Add Employee Dropdown */}
        {!isMaxEmployees && (
          <div className="relative">
            <button
              type="button"
              className="btn btn-outline btn-sm w-full justify-start gap-2"
              onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
            >
              <span>+ Agregar empleado</span>
              {showEmployeeDropdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showEmployeeDropdown && (
              <>
                {/* Backdrop to close dropdown */}
                <Backdrop isVisible={true} onClose={() => setShowEmployeeDropdown(false)} />
                {/* Dropdown Content */}
                <div className="border-base-300 bg-base-100 absolute top-full right-0 left-0 z-50 mt-2 rounded-xl border shadow-xl">
                  {/* Search */}
                  <div className="border-base-300 border-b p-3">
                    <label className={INPUT_SEARCH_SM}>
                      <Search className="text-base-content/50 h-4 w-4" />
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
                  <ul className="max-h-64 overflow-y-auto p-2">
                    {loadingEmployees ? (
                      <li className="flex justify-center p-4">
                        <span className={LOADING_SPINNER_SM} />
                      </li>
                    ) : filteredEmployees.length === 0 ? (
                      <li className="text-base-content/50 p-4 text-center text-sm">No se encontraron empleados</li>
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
                              className={`flex w-full items-center justify-between rounded-lg p-2 transition-all ${
                                isSelected ? "bg-primary/20 text-primary" : "hover:bg-base-200"
                              }`}
                            >
                              <span className="truncate">{emp.full_name}</span>
                              {isSelected && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {selectedEmployeeIds.length === 0 && (
          <p className="text-warning mt-2 text-sm">Selecciona al menos 1 empleado para ver la auditoría</p>
        )}

        {isMaxEmployees && (
          <p className="text-base-content/60 mt-2 text-sm">Máximo {MAX_EMPLOYEES} empleados simultáneos</p>
        )}
      </div>

      {/* Step 3: Results */}
      {canShowCalendar && (
        <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="badge badge-lg badge-primary">3</div>
            <h2 className="text-base-content text-lg font-semibold">Resultados del análisis</h2>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-base-300 bg-base-100 rounded-xl border p-4">
              <div className="text-base-content/70 text-sm">Periodos</div>
              <div className="text-primary mt-2 text-2xl font-bold">{effectiveRanges.length}</div>
            </div>
            <div className="border-base-300 bg-base-100 rounded-xl border p-4">
              <div className="text-base-content/70 text-sm">Registros</div>
              <div className="text-base-content mt-2 text-2xl font-bold">{entries.length}</div>
            </div>
            <div className="border-base-300 bg-base-100 rounded-xl border p-4">
              <div className="text-base-content/70 text-sm">Días con alertas</div>
              <div className={`mt-2 text-2xl font-bold ${totalOverlapDays > 0 ? "text-warning" : "text-success"}`}>
                {totalOverlapDays}
              </div>
            </div>
            <div className="border-base-300 bg-base-100 rounded-xl border p-4">
              <div className="text-base-content/70 text-sm">Conflictos</div>
              <div className={`mt-2 text-2xl font-bold ${totalOverlapPairs > 0 ? "text-error" : "text-success"}`}>
                {totalOverlapPairs}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {errorEntries && <Alert variant="error">{errorEntries}</Alert>}

      {/* Empty States */}
      {selectedEmployeeIds.length === 0 ? (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body items-center py-16 text-center">
            <Users className="text-base-content/30 mb-4 h-12 w-12" />
            <h3 className="text-base-content/70 text-lg font-semibold">Selecciona empleados</h3>
            <p className="text-base-content/50 max-w-md text-sm">
              Elige hasta {MAX_EMPLOYEES} empleados para analizar sus horarios y detectar solapamientos
            </p>
          </div>
        </div>
      ) : !loadingEntries && entries.length === 0 ? (
        <Alert variant="warning">No hay registros para el periodo seleccionado. Prueba con otro rango de fechas.</Alert>
      ) : null}

      {/* Calendar */}
      {canShowCalendar && (
        <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-base-content mb-6 text-lg font-semibold">Calendario de auditoría</h2>
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            }
          >
            <TimesheetAuditCalendar
              entries={entries}
              loading={loadingEntries}
              selectedEmployeeIds={selectedEmployeeIds}
              focusDate={focusDate}
              visibleDateRanges={effectiveRanges}
            />
          </Suspense>
        </div>
      )}

      {/* Legend (collapsible) */}
      {canShowCalendar && entries.length > 0 && (
        <div className="border-base-300 bg-base-100 rounded-2xl border shadow-sm">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left font-medium select-none"
            onClick={() => setLegendOpen(!legendOpen)}
          >
            <span>📋 Guía de interpretación</span>
            <ChevronDown
              size={16}
              className={cn("transform transition-transform duration-300", legendOpen && "rotate-180")}
            />
          </button>
          <SmoothCollapse isOpen={legendOpen}>
            <div className="px-4 pt-0 pb-4">
              <div className="grid gap-6 pt-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="bg-accent mt-1 h-4 w-4 shrink-0 rounded" />
                  <div>
                    <p className="text-base-content font-semibold">Sin conflicto</p>
                    <p className="text-base-content/70 text-sm">Turnos sin solapamiento</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-error mt-1 h-4 w-4 shrink-0 rounded" />
                  <div>
                    <p className="text-base-content font-semibold">Conflicto detectado</p>
                    <p className="text-base-content/70 text-sm">Horarios traslapados entre empleados</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg">👩‍⚕️</span>
                  <div>
                    <p className="text-base-content font-semibold">Compatibles</p>
                    <p className="text-base-content/70 text-sm">Enfermero + TENS pueden coexistir</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg">⌛</span>
                  <div>
                    <p className="text-base-content font-semibold">Tooltip</p>
                    <p className="text-base-content/70 text-sm">Pasa el cursor para ver detalles del conflicto</p>
                  </div>
                </div>
              </div>
            </div>
          </SmoothCollapse>
        </div>
      )}
    </section>
  );
}
