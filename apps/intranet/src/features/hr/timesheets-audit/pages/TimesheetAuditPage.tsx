/**
 * Timesheet Audit Page (Redesigned)
 * A more ergonomic, user-friendly interface for auditing employee schedules
 */

import { ButtonGroup, Card, Chip, Description, Skeleton } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { ChevronDown, Users, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select, SelectItem } from "@/components/ui/Select";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
import { useAuth } from "@/context/AuthContext";
import { EmployeeMultiSelectPopover } from "@/features/hr/components/EmployeeMultiSelectPopover";
import { employeeKeys } from "@/features/hr/employees/queries";
import type { Employee } from "@/features/hr/employees/types";
import { useMonths } from "@/features/hr/timesheets/hooks/use-months";
import {
  type AuditDateRange,
  useTimesheetAudit,
} from "@/features/hr/timesheets-audit/hooks/use-timesheet-audit";
import type { TimesheetEntryWithEmployee } from "@/features/hr/timesheets-audit/types";
import { detectAllOverlaps } from "@/features/hr/timesheets-audit/utils/overlap-detection";
import { endOfMonth, monthsAgoEnd, monthsAgoStart, startOfMonth } from "@/lib/dates";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";

import "dayjs/locale/es";

const TimesheetAuditCalendar = lazy(() =>
  import("@/features/hr/timesheets-audit/components/TimesheetAuditCalendar").then((m) => ({
    default: m.TimesheetAuditCalendar,
  })),
);

dayjs.extend(isoWeek);
dayjs.locale("es");

type QuickRange =
  | "custom"
  | "last-month"
  | "last-week"
  | "this-month"
  | "this-week"
  | "two-months-ago";

interface WeekDefinition {
  end: Date;
  key: string;
  label: string;
  month: string;
  number: number;
  start: Date;
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
export function TimesheetAuditPage() {
  useAuth();

  // Data state
  const { months } = useMonths();

  const { data: employees } = useSuspenseQuery({
    ...employeeKeys.list({ includeInactive: false }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Selection state
  const [quickRange, setQuickRange] = useState<QuickRange>("last-week");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);

  // UI state
  const [customWeeksOpen, setCustomWeeksOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);

  // Ref to track if month has been initialized
  const monthInitialized = useRef(false);

  // Build weeks for the selected month
  const weeksForMonth = selectedMonth ? buildWeeksForMonth(selectedMonth) : [];

  // Active employees with search
  const activeEmployees = employees.filter((emp) => emp.status === "ACTIVE");

  const employeeOptions = activeEmployees.map((emp) => ({
    id: emp.id,
    label: emp.full_name,
  }));

  // Set default month when months load (only once)
  useEffect(() => {
    if (months.length > 0 && !selectedMonth && !monthInitialized.current) {
      const prevMonth = dayjs().subtract(1, "month").format("YYYY-MM");
      setSelectedMonth(months.includes(prevMonth) ? prevMonth : (months[0] ?? ""));
      monthInitialized.current = true;
    }
  }, [months, selectedMonth]);

  // Calculate effective date ranges based on quick range or custom selection
  const effectiveRanges = ((): AuditDateRange[] => {
    if (quickRange !== "custom") {
      const range = getQuickRangeValues(quickRange);
      return range ? [range] : [];
    }

    // Custom: use selected weeks
    if (selectedWeekKeys.length === 0 || !selectedMonth) {
      return [];
    }

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

  const handleRemoveEmployee = (employeeId: number) => {
    setSelectedEmployeeIds((prev) => prev.filter((id) => id !== employeeId));
  };

  const handleClearEmployees = () => {
    setSelectedEmployeeIds([]);
  };

  // Format range summary
  const rangeSummary = (() => {
    if (effectiveRanges.length === 0) {
      return "";
    }
    const first = dayjs(effectiveRanges[0]?.start);
    const last = dayjs(effectiveRanges.at(-1)?.end);
    return `${first.format("D MMM")} → ${last.format("D MMM YYYY")}`;
  })();

  const isMaxEmployees = selectedEmployeeIds.length >= MAX_EMPLOYEES;
  const canShowCalendar = selectedEmployeeIds.length > 0 && effectiveRanges.length > 0;

  return (
    <section className={PAGE_CONTAINER}>
      <PeriodSelectionPanel
        customWeeksOpen={customWeeksOpen}
        handleQuickRangeChange={handleQuickRangeChange}
        handleSelectAllWeeks={handleSelectAllWeeks}
        handleWeekToggle={handleWeekToggle}
        months={months}
        quickRange={quickRange}
        rangeSummary={rangeSummary}
        selectedMonth={selectedMonth}
        selectedWeekKeys={selectedWeekKeys}
        setCustomWeeksOpen={setCustomWeeksOpen}
        setSelectedMonth={setSelectedMonth}
        setSelectedWeekKeys={setSelectedWeekKeys}
        weeksForMonth={weeksForMonth}
      />

      <EmployeeSelectionPanel
        activeEmployees={activeEmployees}
        employeeOptions={employeeOptions}
        handleClearEmployees={handleClearEmployees}
        handleRemoveEmployee={handleRemoveEmployee}
        isMaxEmployees={isMaxEmployees}
        selectedEmployeeIds={selectedEmployeeIds}
        setSelectedEmployeeIds={setSelectedEmployeeIds}
      />

      <ResultsSummaryPanel
        canShowCalendar={canShowCalendar}
        entriesCount={entries.length}
        rangesCount={effectiveRanges.length}
        totalOverlapDays={totalOverlapDays}
        totalOverlapPairs={totalOverlapPairs}
      />

      <AuditEmptyState
        entriesCount={entries.length}
        selectedEmployeeCount={selectedEmployeeIds.length}
      />

      <CalendarPanel
        canShowCalendar={canShowCalendar}
        effectiveRanges={effectiveRanges}
        entries={entries}
        focusDate={focusDate}
        selectedEmployeeIds={selectedEmployeeIds}
      />

      <LegendPanel
        entriesCount={entries.length}
        isOpen={legendOpen}
        onToggle={() => setLegendOpen(!legendOpen)}
        show={canShowCalendar}
      />
    </section>
  );
}

function PeriodSelectionPanel({
  customWeeksOpen,
  handleQuickRangeChange,
  handleSelectAllWeeks,
  handleWeekToggle,
  months,
  quickRange,
  rangeSummary,
  selectedMonth,
  selectedWeekKeys,
  setCustomWeeksOpen,
  setSelectedMonth,
  setSelectedWeekKeys,
  weeksForMonth,
}: {
  customWeeksOpen: boolean;
  handleQuickRangeChange: (range: QuickRange) => void;
  handleSelectAllWeeks: () => void;
  handleWeekToggle: (key: string) => void;
  months: string[];
  quickRange: QuickRange;
  rangeSummary: string;
  selectedMonth: string;
  selectedWeekKeys: string[];
  setCustomWeeksOpen: (open: boolean) => void;
  setSelectedMonth: (month: string) => void;
  setSelectedWeekKeys: (keys: string[]) => void;
  weeksForMonth: WeekDefinition[];
}) {
  return (
    <div className="rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <Chip color="accent" size="lg" variant="primary">
          1
        </Chip>
        <span className="font-semibold text-foreground text-lg">Selecciona el periodo</span>
        {rangeSummary && <span className="ml-auto text-default-500 text-sm">({rangeSummary})</span>}
      </div>

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

      {quickRange === "custom" && (
        <div className="mt-4 rounded-xl bg-default-50/50">
          <Button
            className="w-full justify-between px-4 py-3"
            onPress={() => setCustomWeeksOpen(!customWeeksOpen)}
            variant="ghost"
          >
            <span>Personalizar semanas específicas</span>
            <ChevronDown
              className={cn(
                "transform transition-transform duration-300",
                customWeeksOpen && "rotate-180",
              )}
              size={16}
            />
          </Button>
          <SmoothCollapse isOpen={customWeeksOpen}>
            <div className="space-y-4 px-4 pt-0 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Select
                  aria-label="Seleccionar mes"
                  className="max-w-xs flex-1"
                  placeholder="Seleccionar mes"
                  value={selectedMonth}
                  onChange={(key) => {
                    if (key) {
                      setSelectedMonth(key.toString());
                      setSelectedWeekKeys([]);
                    }
                  }}
                >
                  {months.map((month) => (
                    <SelectItem id={month} key={month}>
                      {dayjs(`${month}-01`).format("MMMM YYYY")}
                    </SelectItem>
                  ))}
                </Select>
                {weeksForMonth.length > 0 && (
                  <Button
                    className="text-primary text-sm"
                    onPress={handleSelectAllWeeks}
                    size="sm"
                    variant="ghost"
                  >
                    {selectedWeekKeys.length === weeksForMonth.length
                      ? "Deseleccionar todas"
                      : "Seleccionar todas"}
                  </Button>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {weeksForMonth.map((week) => {
                  const isActive = selectedWeekKeys.includes(week.key);
                  return (
                    <Button
                      className={cn(
                        "justify-start rounded-lg border p-3 text-left transition-all",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-default-200 bg-background text-foreground hover:border-primary/50",
                      )}
                      key={week.key}
                      onPress={() => handleWeekToggle(week.key)}
                      variant="ghost"
                    >
                      <div className="font-medium text-sm">{week.label}</div>
                    </Button>
                  );
                })}
              </div>

              {selectedWeekKeys.length === 0 && (
                <Description className="text-sm text-warning">
                  Selecciona al menos una semana
                </Description>
              )}
            </div>
          </SmoothCollapse>
        </div>
      )}
    </div>
  );
}

function EmployeeSelectionPanel({
  activeEmployees,
  employeeOptions,
  handleClearEmployees,
  handleRemoveEmployee,
  isMaxEmployees,
  selectedEmployeeIds,
  setSelectedEmployeeIds,
}: {
  activeEmployees: Employee[];
  employeeOptions: Array<{ id: number; label: string }>;
  handleClearEmployees: () => void;
  handleRemoveEmployee: (id: number) => void;
  isMaxEmployees: boolean;
  selectedEmployeeIds: number[];
  setSelectedEmployeeIds: (ids: number[]) => void;
}) {
  return (
    <div className="rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <Chip color="accent" size="lg" variant="primary">
          2
        </Chip>
        <span className="font-semibold text-foreground text-lg">Selecciona empleados</span>
        <span className="ml-auto text-default-500 text-sm">
          {selectedEmployeeIds.length}/{MAX_EMPLOYEES}
        </span>
      </div>

      {selectedEmployeeIds.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selectedEmployeeIds.map((id) => {
            const emp = activeEmployees.find((e) => e.id === id);
            if (!emp) {
              return null;
            }
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
            <Button
              className="text-danger text-sm"
              onPress={handleClearEmployees}
              size="sm"
              variant="ghost"
            >
              Limpiar todos
            </Button>
          )}
        </div>
      )}

      {!isMaxEmployees && (
        <EmployeeMultiSelectPopover
          buttonLabel="+ Agregar empleado"
          maxSelected={MAX_EMPLOYEES}
          onChange={setSelectedEmployeeIds}
          options={employeeOptions}
          selectedIds={selectedEmployeeIds}
        />
      )}

      {selectedEmployeeIds.length === 0 && (
        <Description className="mt-2 text-sm text-warning">
          Selecciona al menos 1 empleado para ver la auditoría
        </Description>
      )}

      {isMaxEmployees && (
        <Description className="mt-2 text-default-500 text-sm">
          Máximo {MAX_EMPLOYEES} empleados simultáneos
        </Description>
      )}
    </div>
  );
}

function ResultsSummaryPanel({
  canShowCalendar,
  entriesCount,
  rangesCount,
  totalOverlapDays,
  totalOverlapPairs,
}: {
  canShowCalendar: boolean;
  entriesCount: number;
  rangesCount: number;
  totalOverlapDays: number;
  totalOverlapPairs: number;
}) {
  if (!canShowCalendar) {
    return null;
  }
  return (
    <div className="rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <Chip color="accent" size="lg" variant="primary">
          3
        </Chip>
        <span className="font-semibold text-foreground text-lg">Resultados del análisis</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-default-200 bg-background p-4">
          <div className="text-default-600 text-sm">Periodos</div>
          <div className="mt-2 font-bold text-2xl text-primary">{rangesCount}</div>
        </div>
        <div className="rounded-xl border border-default-200 bg-background p-4">
          <div className="text-default-600 text-sm">Registros</div>
          <div className="mt-2 font-bold text-2xl text-foreground">{entriesCount}</div>
        </div>
        <div className="rounded-xl border border-default-200 bg-background p-4">
          <div className="text-default-600 text-sm">Días con alertas</div>
          <div
            className={`mt-2 font-bold text-2xl ${totalOverlapDays > 0 ? "text-warning" : "text-success"}`}
          >
            {totalOverlapDays}
          </div>
        </div>
        <div className="rounded-xl border border-default-200 bg-background p-4">
          <div className="text-default-600 text-sm">Conflictos</div>
          <div
            className={`mt-2 font-bold text-2xl ${totalOverlapPairs > 0 ? "text-danger" : "text-success"}`}
          >
            {totalOverlapPairs}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditEmptyState({
  entriesCount,
  selectedEmployeeCount,
}: {
  entriesCount: number;
  selectedEmployeeCount: number;
}) {
  if (selectedEmployeeCount === 0) {
    return (
      <Card className="shadow-sm">
        <Card.Content className="flex flex-col items-center py-16 text-center">
          <Users className="mb-4 h-12 w-12 text-default-200" />
          <span className="font-semibold text-default-600 text-lg">Selecciona empleados</span>
          <Description className="max-w-md text-default-400 text-sm">
            Elige hasta {MAX_EMPLOYEES} empleados para analizar sus horarios y detectar
            solapamientos
          </Description>
        </Card.Content>
      </Card>
    );
  }
  if (entriesCount === 0) {
    return (
      <Alert status="warning">
        No hay registros para el periodo seleccionado. Prueba con otro rango de fechas.
      </Alert>
    );
  }
  return null;
}

function CalendarPanel({
  canShowCalendar,
  effectiveRanges,
  entries,
  focusDate,
  selectedEmployeeIds,
}: {
  canShowCalendar: boolean;
  effectiveRanges: AuditDateRange[];
  entries: TimesheetEntryWithEmployee[];
  focusDate: Date | null;
  selectedEmployeeIds: number[];
}) {
  if (!canShowCalendar) {
    return null;
  }
  return (
    <div className="rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
      <span className="mb-6 block font-semibold text-foreground text-lg">
        Calendario de auditoría
      </span>
      <Suspense
        fallback={
          <div className="space-y-3">
            <Skeleton className="h-6 w-56 rounded-md" />
            <Skeleton className="h-64 w-full rounded-xl" />
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
  );
}

function LegendPanel({
  entriesCount,
  isOpen,
  onToggle,
  show,
}: {
  entriesCount: number;
  isOpen: boolean;
  onToggle: () => void;
  show: boolean;
}) {
  if (!show || entriesCount === 0) {
    return null;
  }
  return (
    <div className="rounded-2xl border border-default-200 bg-background shadow-sm">
      <Button className="w-full justify-between px-4 py-3" onPress={onToggle} variant="ghost">
        <span>📋 Guía de interpretación</span>
        <ChevronDown
          className={cn("transform transition-transform duration-300", isOpen && "rotate-180")}
          size={16}
        />
      </Button>
      <SmoothCollapse isOpen={isOpen}>
        <div className="px-4 pt-0 pb-4">
          <div className="grid gap-6 pt-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-4 w-4 shrink-0 rounded bg-success" />
              <div>
                <span className="font-semibold text-foreground">Sin conflicto</span>
                <Description className="text-default-600 text-sm">
                  Turnos sin solapamiento
                </Description>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-4 w-4 shrink-0 rounded bg-danger" />
              <div>
                <span className="font-semibold text-foreground">Conflicto detectado</span>
                <Description className="text-default-600 text-sm">
                  Horarios traslapados entre empleados
                </Description>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">👩‍⚕️</span>
              <div>
                <span className="font-semibold text-foreground">Compatibles</span>
                <Description className="text-default-600 text-sm">
                  Enfermero + TENS pueden coexistir
                </Description>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">⌛</span>
              <div>
                <span className="font-semibold text-foreground">Tooltip</span>
                <Description className="text-default-600 text-sm">
                  Pasa el cursor o toca un bloque para ver detalles del conflicto
                </Description>
              </div>
            </div>
          </div>
        </div>
      </SmoothCollapse>
    </div>
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
        end: clampedEnd.toDate(),
        key: `${month}:${weekNumber}`,
        label: `S${weekNumber} (${clampedStart.format("D")} - ${clampedEnd.format("D MMM")})`,
        month,
        number: weekNumber,
        start: clampedStart.toDate(),
      });
      seen.add(weekNumber);
    }
    cursor = cursor.add(1, "week");
  }

  return weeks;
}

function getQuickRangeValues(range: QuickRange): null | { end: Date; start: Date } {
  const today = dayjs();
  const ranges: Partial<Record<QuickRange, { end: Date; start: Date }>> = {
    "last-month": {
      end: dayjs(monthsAgoEnd(1)).toDate(),
      start: dayjs(monthsAgoStart(1)).toDate(),
    },
    "last-week": {
      end: today.subtract(1, "week").endOf("isoWeek").toDate(),
      start: today.subtract(1, "week").startOf("isoWeek").toDate(),
    },
    "this-month": {
      end: dayjs(endOfMonth()).toDate(),
      start: dayjs(startOfMonth()).toDate(),
    },
    "this-week": {
      end: today.endOf("isoWeek").toDate(),
      start: today.startOf("isoWeek").toDate(),
    },
    "two-months-ago": {
      end: dayjs(monthsAgoEnd(2)).toDate(),
      start: dayjs(monthsAgoStart(2)).toDate(),
    },
  };

  return ranges[range] ?? null;
}
