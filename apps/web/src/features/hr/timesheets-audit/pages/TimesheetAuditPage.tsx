/**
 * Timesheet Audit Page (Redesigned)
 * A more ergonomic, user-friendly interface for auditing employee schedules
 */

import { ButtonGroup, Chip, ListBox, Select, Spinner } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { Check, ChevronDown, ChevronUp, Search, Users, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Alert from "@/components/ui/Alert";
import Backdrop from "@/components/ui/Backdrop";
import Button from "@/components/ui/Button";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
import { useAuth } from "@/context/AuthContext";
import { fetchEmployees } from "@/features/hr/employees/api";
import { useMonths } from "@/features/hr/timesheets/hooks/use-months";
import {
  type AuditDateRange,
  useTimesheetAudit,
} from "@/features/hr/timesheets-audit/hooks/use-timesheet-audit";
import { detectAllOverlaps } from "@/features/hr/timesheets-audit/utils/overlap-detection";
import { endOfMonth, monthsAgoEnd, monthsAgoStart, startOfMonth } from "@/lib/dates";
import { INPUT_SEARCH_SM } from "@/lib/styles";
import { cn } from "@/lib/utils";

import "dayjs/locale/es";

const TimesheetAuditCalendar = lazy(
  () => import("@/features/hr/timesheets-audit/components/TimesheetAuditCalendar"),
);

dayjs.extend(isoWeek);
dayjs.locale("es");

const DATE_ISO_FORMAT = "YYYY-MM-DD";

type QuickRange =
  | "custom"
  | "last-month"
  | "last-week"
  | "this-month"
  | "this-week"
  | "two-months-ago";

interface WeekDefinition {
  end: string;
  key: string;
  label: string;
  month: string;
  number: number;
  start: string;
}

const QUICK_RANGES: { id: QuickRange; label: string }[] = [
  { id: "this-week", label: "Esta semana" },
  { id: "last-week", label: "Semana pasada" },
  { id: "this-month", label: "Este mes" },
  { id: "last-month", label: "Mes pasado" },
  { id: "two-months-ago", label: "Mes antepasado" },
  { id: "custom", label: "Personalizado" },
];

const MAX_EMPLOYEES = 5;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy component
export default function TimesheetAuditPage() {
  useAuth();

  // Data state
  const { months } = useMonths();

  const { data: employees } = useSuspenseQuery({
    queryFn: () => fetchEmployees(false),
    queryKey: ["employees", "active-only"], // We might want to be specific if we change the fetch param later
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

  // Ref to track if month has been initialized
  const monthInitialized = useRef(false);

  // Build weeks for the selected month
  const weeksForMonth = selectedMonth ? buildWeeksForMonth(selectedMonth) : [];

  // Active employees with search
  const activeEmployees = employees.filter((emp) => emp.status === "ACTIVE");

  const filteredEmployees = (() => {
    if (!employeeSearch.trim()) return activeEmployees;
    const search = employeeSearch.toLowerCase();
    return activeEmployees.filter((emp) => emp.full_name.toLowerCase().includes(search));
  })();

  // Set default month when months load (only once)
  useEffect(() => {
    if (months.length > 0 && !selectedMonth && !monthInitialized.current) {
      const prevMonth = dayjs().subtract(1, "month").format("YYYY-MM");
      setSelectedMonth(months.includes(prevMonth) ? prevMonth : (months[0] ?? ""));
      monthInitialized.current = true;
    }
  }, [months, selectedMonth]);

  // Cleanup: close dropdown on unmount to prevent event listeners hanging
  useEffect(() => {
    return () => {
      setShowEmployeeDropdown(false);
    };
  }, []);

  // Calculate effective date ranges based on quick range or custom selection
  const effectiveRanges = ((): AuditDateRange[] => {
    if (quickRange !== "custom") {
      const range = getQuickRangeValues(quickRange);
      return range ? [range] : [];
    }

    // Custom: use selected weeks
    if (selectedWeekKeys.length === 0 || !selectedMonth) return [];

    return selectedWeekKeys
      .map((key) => {
        const week = weeksForMonth.find((w) => w.key === key);
        return week ? { end: week.end, start: week.start } : null;
      })
      .filter((r): r is AuditDateRange => r !== null);
  })();

  const focusDate = effectiveRanges[0]?.start ?? null;

  // Fetch audit data
  const { entries } = useTimesheetAudit({
    employeeIds: selectedEmployeeIds,
    ranges: effectiveRanges,
  });

  // Calculate overlaps
  const overlapsByDate = detectAllOverlaps(entries);
  const totalOverlapDays = overlapsByDate.size;
  const totalOverlapPairs = [...overlapsByDate.values()].reduce(
    (sum, info) => sum + info.total_overlapping_pairs,
    0,
  );

  // Handlers
  const handleQuickRangeChange = (range: QuickRange) => {
    setQuickRange(range);
  };

  const handleWeekToggle = (key: string) => {
    setSelectedWeekKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleSelectAllWeeks = () => {
    setSelectedWeekKeys((prev) => {
      const allKeys = weeksForMonth.map((w) => w.key);
      const allSelected = allKeys.every((k) => prev.includes(k));
      return allSelected ? [] : allKeys;
    });
  };

  const handleEmployeeToggle = (employeeId: number) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      }
      if (prev.length >= MAX_EMPLOYEES) return prev;
      return [...prev, employeeId];
    });
  };

  const handleRemoveEmployee = (employeeId: number) => {
    setSelectedEmployeeIds((prev) => prev.filter((id) => id !== employeeId));
  };

  const handleClearEmployees = () => {
    setSelectedEmployeeIds([]);
  };

  // Format range summary
  const rangeSummary = (() => {
    if (effectiveRanges.length === 0) return "";
    const first = dayjs(effectiveRanges[0]?.start);
    const last = dayjs(effectiveRanges.at(-1)?.end);
    return `${first.format("D MMM")} → ${last.format("D MMM YYYY")}`;
  })();

  const isMaxEmployees = selectedEmployeeIds.length >= MAX_EMPLOYEES;
  const canShowCalendar = selectedEmployeeIds.length > 0 && effectiveRanges.length > 0;

  return (
    <section className="space-y-6">
      {/* Step 1: Period Selection */}
      <div className="border-default-200 bg-background rounded-2xl border p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Chip color="accent" size="lg" variant="primary">
            1
          </Chip>
          <h2 className="text-foreground text-lg font-semibold">Selecciona el periodo</h2>
          {rangeSummary && (
            <span className="text-default-500 ml-auto text-sm">({rangeSummary})</span>
          )}
        </div>

        {/* Quick Range Buttons */}
        <div className="overflow-x-auto pb-2">
          <ButtonGroup className="min-w-max">
            {QUICK_RANGES.map((range) => (
              <Button
                size="sm"
                variant={quickRange === range.id ? "primary" : "ghost"}
                key={range.id}
                onPress={() => {
                  handleQuickRangeChange(range.id);
                }}
              >
                {range.label}
              </Button>
            ))}
          </ButtonGroup>
        </div>

        {/* Custom Week Picker (collapsible) */}
        {quickRange === "custom" && (
          <div className="bg-default-50/50 mt-4 rounded-xl">
            <button
              className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left font-medium select-none"
              onClick={() => {
                setCustomWeeksOpen(!customWeeksOpen);
              }}
              type="button"
            >
              <span>Personalizar semanas específicas</span>
              <ChevronDown
                className={cn(
                  "transform transition-transform duration-300",
                  customWeeksOpen && "rotate-180",
                )}
                size={16}
              />
            </button>
            <SmoothCollapse isOpen={customWeeksOpen}>
              <div className="space-y-4 px-4 pt-0 pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Select
                    aria-label="Seleccionar mes"
                    className="max-w-xs flex-1"
                    placeholder="Seleccionar mes"
                    selectedKey={selectedMonth}
                    onSelectionChange={(key) => {
                      if (key) {
                        setSelectedMonth(key.toString());
                        setSelectedWeekKeys([]);
                      }
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {months.map((month) => (
                          <ListBox.Item
                            key={month}
                            textValue={dayjs(`${month}-01`).format("MMMM YYYY")}
                          >
                            {dayjs(`${month}-01`).format("MMMM YYYY")}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {weeksForMonth.length > 0 && (
                    <button
                      className="link link-primary text-sm whitespace-nowrap"
                      onClick={handleSelectAllWeeks}
                      type="button"
                    >
                      {selectedWeekKeys.length === weeksForMonth.length
                        ? "Deseleccionar todas"
                        : "Seleccionar todas"}
                    </button>
                  )}
                </div>

                {/* Weeks Grid */}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {weeksForMonth.map((week) => {
                    const isActive = selectedWeekKeys.includes(week.key);
                    return (
                      <button
                        className={`rounded-lg border p-3 text-left transition-all ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-default-200 bg-background text-foreground hover:border-primary/50"
                        }`}
                        key={week.key}
                        onClick={() => {
                          handleWeekToggle(week.key);
                        }}
                        type="button"
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
      <div className="border-default-200 bg-background rounded-2xl border p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Chip color="accent" size="lg" variant="primary">
            2
          </Chip>
          <h2 className="text-foreground text-lg font-semibold">Selecciona empleados</h2>
          <span className="text-default-500 ml-auto text-sm">
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
                <Chip className="gap-2 px-3 py-2" color="accent" key={id} variant="primary">
                  <span>{emp.full_name}</span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={`Quitar ${emp.full_name}`}
                    className="h-5 w-5 min-w-5 p-0"
                    onPress={() => {
                      handleRemoveEmployee(id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Chip>
              );
            })}
            {selectedEmployeeIds.length > 0 && (
              <button
                className="link link-error text-sm"
                onClick={handleClearEmployees}
                type="button"
              >
                Limpiar todos
              </button>
            )}
          </div>
        )}

        {/* Add Employee Dropdown */}
        {!isMaxEmployees && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onPress={() => {
                setShowEmployeeDropdown(!showEmployeeDropdown);
              }}
            >
              <span>+ Agregar empleado</span>
              {showEmployeeDropdown ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showEmployeeDropdown && (
              <>
                {/* Backdrop to close dropdown */}
                <Backdrop
                  isVisible={true}
                  onClose={() => {
                    setShowEmployeeDropdown(false);
                  }}
                />
                {/* Dropdown Content */}
                <div className="border-default-200 bg-background absolute top-full right-0 left-0 z-50 mt-2 rounded-xl border shadow-xl">
                  {/* Search */}
                  <div className="border-default-200 border-b p-3">
                    <label className={INPUT_SEARCH_SM}>
                      <Search className="text-default-400 h-4 w-4" />
                      <input
                        className="grow bg-transparent outline-none"
                        onChange={(e) => {
                          setEmployeeSearch(e.target.value);
                        }}
                        placeholder="Buscar empleado..."
                        type="text"
                        value={employeeSearch}
                      />
                    </label>
                  </div>

                  {/* Employee List */}
                  <ul className="max-h-64 overflow-y-auto p-2">
                    {(() => {
                      if (filteredEmployees.length === 0) {
                        return (
                          <li className="text-default-400 p-4 text-center text-sm">
                            No se encontraron empleados
                          </li>
                        );
                      }
                      return (
                        <>
                          {filteredEmployees.map((emp) => {
                            const isSelected = selectedEmployeeIds.includes(emp.id);
                            return (
                              <li key={emp.id}>
                                <button
                                  className={`flex w-full items-center justify-between rounded-lg p-2 transition-all ${
                                    isSelected ? "bg-primary/20 text-primary" : "hover:bg-default-50"
                                  }`}
                                  onClick={() => {
                                    handleEmployeeToggle(emp.id);
                                    if (
                                      !isSelected &&
                                      selectedEmployeeIds.length + 1 >= MAX_EMPLOYEES
                                    ) {
                                      setShowEmployeeDropdown(false);
                                    }
                                  }}
                                  type="button"
                                >
                                  <span className="truncate">{emp.full_name}</span>
                                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                              </li>
                            );
                          })}
                        </>
                      );
                    })()}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {selectedEmployeeIds.length === 0 && (
          <p className="text-warning mt-2 text-sm">
            Selecciona al menos 1 empleado para ver la auditoría
          </p>
        )}

        {isMaxEmployees && (
          <p className="text-default-500 mt-2 text-sm">
            Máximo {MAX_EMPLOYEES} empleados simultáneos
          </p>
        )}
      </div>

      {/* Step 3: Results */}
      {canShowCalendar && (
        <div className="border-default-200 bg-background rounded-2xl border p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <Chip color="accent" size="lg" variant="primary">
              3
            </Chip>
            <h2 className="text-foreground text-lg font-semibold">Resultados del análisis</h2>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-default-200 bg-background rounded-xl border p-4">
              <div className="text-default-600 text-sm">Periodos</div>
              <div className="text-primary mt-2 text-2xl font-bold">{effectiveRanges.length}</div>
            </div>
            <div className="border-default-200 bg-background rounded-xl border p-4">
              <div className="text-default-600 text-sm">Registros</div>
              <div className="text-foreground mt-2 text-2xl font-bold">{entries.length}</div>
            </div>
            <div className="border-default-200 bg-background rounded-xl border p-4">
              <div className="text-default-600 text-sm">Días con alertas</div>
              <div
                className={`mt-2 text-2xl font-bold ${totalOverlapDays > 0 ? "text-warning" : "text-success"}`}
              >
                {totalOverlapDays}
              </div>
            </div>
            <div className="border-default-200 bg-background rounded-xl border p-4">
              <div className="text-default-600 text-sm">Conflictos</div>
              <div
                className={`mt-2 text-2xl font-bold ${totalOverlapPairs > 0 ? "text-danger" : "text-success"}`}
              >
                {totalOverlapPairs}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty States */}
      {(() => {
        if (selectedEmployeeIds.length === 0) {
          return (
            <div className="card bg-background shadow-sm">
              <div className="card-body items-center py-16 text-center">
                <Users className="text-default-200 mb-4 h-12 w-12" />
                <h3 className="text-default-600 text-lg font-semibold">Selecciona empleados</h3>
                <p className="text-default-400 max-w-md text-sm">
                  Elige hasta {MAX_EMPLOYEES} empleados para analizar sus horarios y detectar
                  solapamientos
                </p>
              </div>
            </div>
          );
        }
        if (entries.length === 0) {
          return (
            <Alert variant="warning">
              No hay registros para el periodo seleccionado. Prueba con otro rango de fechas.
            </Alert>
          );
        }
        return null;
      })()}

      {/* Calendar */}
      {canShowCalendar && (
        <div className="border-default-200 bg-background rounded-2xl border p-6 shadow-sm">
          <h2 className="text-foreground mb-6 text-lg font-semibold">Calendario de auditoría</h2>
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <Spinner className="text-primary" color="current" size="lg" />
              </div>
            }
          >
            <TimesheetAuditCalendar
              entries={entries}
              focusDate={focusDate}
              loading={false}
              selectedEmployeeIds={selectedEmployeeIds}
              visibleDateRanges={effectiveRanges}
            />
          </Suspense>
        </div>
      )}

      {/* Legend (collapsible) */}
      {canShowCalendar && entries.length > 0 && (
        <div className="border-default-200 bg-background rounded-2xl border shadow-sm">
          <button
            className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left font-medium select-none"
            onClick={() => {
              setLegendOpen(!legendOpen);
            }}
            type="button"
          >
            <span>📋 Guía de interpretación</span>
            <ChevronDown
              className={cn(
                "transform transition-transform duration-300",
                legendOpen && "rotate-180",
              )}
              size={16}
            />
          </button>
          <SmoothCollapse isOpen={legendOpen}>
            <div className="px-4 pt-0 pb-4">
              <div className="grid gap-6 pt-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="bg-success mt-1 h-4 w-4 shrink-0 rounded" />
                  <div>
                    <p className="text-foreground font-semibold">Sin conflicto</p>
                    <p className="text-default-600 text-sm">Turnos sin solapamiento</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-danger mt-1 h-4 w-4 shrink-0 rounded" />
                  <div>
                    <p className="text-foreground font-semibold">Conflicto detectado</p>
                    <p className="text-default-600 text-sm">
                      Horarios traslapados entre empleados
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg">👩‍⚕️</span>
                  <div>
                    <p className="text-foreground font-semibold">Compatibles</p>
                    <p className="text-default-600 text-sm">
                      Enfermero + TENS pueden coexistir
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg">⌛</span>
                  <div>
                    <p className="text-foreground font-semibold">Tooltip</p>
                    <p className="text-default-600 text-sm">
                      Pasa el cursor para ver detalles del conflicto
                    </p>
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
        end: clampedEnd.format(DATE_ISO_FORMAT),
        key: `${month}:${weekNumber}`,
        label: `S${weekNumber} (${clampedStart.format("D")} - ${clampedEnd.format("D MMM")})`,
        month,
        number: weekNumber,
        start: clampedStart.format(DATE_ISO_FORMAT),
      });
      seen.add(weekNumber);
    }
    cursor = cursor.add(1, "week");
  }

  return weeks;
}

function getQuickRangeValues(range: QuickRange): null | { end: string; start: string } {
  const today = dayjs();
  switch (range) {
    case "last-month": {
      return {
        end: monthsAgoEnd(1),
        start: monthsAgoStart(1),
      };
    }
    case "last-week": {
      return {
        end: today.subtract(1, "week").endOf("isoWeek").format(DATE_ISO_FORMAT),
        start: today.subtract(1, "week").startOf("isoWeek").format(DATE_ISO_FORMAT),
      };
    }
    case "this-month": {
      return {
        end: endOfMonth(),
        start: startOfMonth(),
      };
    }
    case "this-week": {
      return {
        end: today.endOf("isoWeek").format(DATE_ISO_FORMAT),
        start: today.startOf("isoWeek").format(DATE_ISO_FORMAT),
      };
    }
    case "two-months-ago": {
      return {
        end: monthsAgoEnd(2),
        start: monthsAgoStart(2),
      };
    }
    default: {
      return null;
    }
  }
}
