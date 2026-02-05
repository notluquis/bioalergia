import { Chip, DateField, DateInputGroup, Label, Separator, Spinner, Tabs } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { BarChart2, BarChart3, Calendar, Clock, Filter, List, TrendingUp, X } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select, SelectItem } from "@/components/ui/Select";

import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/context/AuthContext";
import { EmployeeMultiSelectPopover } from "@/features/hr/components/EmployeeMultiSelectPopover";
import { employeeKeys } from "@/features/hr/employees/queries";
import type { Employee } from "@/features/hr/employees/types";
import { useMonths } from "@/features/hr/timesheets/hooks/use-months";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { fetchGlobalTimesheetRange } from "../api";
import { getHRReportsColumns, type HRReportsTableMeta } from "../components/HRReportsColumns";
import type { EmployeeWorkData, ReportGranularity } from "../types";
import { calculateStats, prepareComparisonData } from "../utils";

import "dayjs/locale/es";

// Lazy-load chart components (Recharts ~400KB)
const TemporalChart = lazy(() =>
  import("../components/ReportCharts").then((m) => ({ default: m.TemporalChart })),
);
const DistributionChart = lazy(() =>
  import("../components/ReportCharts").then((m) => ({ default: m.DistributionChart })),
);

dayjs.extend(isoWeek);
dayjs.locale("es");

const DATE_FORMAT = "YYYY-MM-DD";

// --- Helper Functions in Scope ---
interface RawTimesheetEntry {
  employee_id: number;
  overtime_minutes: number;
  work_date: string; // YYYY-MM-DD
  worked_minutes: number;
}

type ViewMode = "all" | "month" | "range";
export function ReportsPage() {
  const { can } = useAuth();
  const canView = can("read", "Report");

  // Selection state
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [startDate, setStartDate] = useState<string>(() =>
    dayjs().startOf("month").format(DATE_FORMAT),
  );
  const [endDate, setEndDate] = useState<string>(() => dayjs().endOf("month").format(DATE_FORMAT));
  const [granularity, setGranularity] = useState<ReportGranularity>("month");
  const granularityLabel = { day: "día", month: "mes", week: "sem" }[granularity];

  // We need to manage "trigger" state manually or rely on effective params
  const [isReportEnabled, setIsReportEnabled] = useState(false);
  const [timestamp, setTimestamp] = useState(0); // To force re-fetch on click

  // UI State
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);

  // 1. Load Months and Employees
  const { months, monthsWithData } = useMonths();
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  useEffect(() => {
    if (months.length > 0 && !selectedMonth) {
      setSelectedMonth(months[0] ?? "");
    }
  }, [months, selectedMonth]);

  useEffect(() => {
    if (viewMode === "month") {
      setGranularity("week");
    } else if (viewMode === "all") {
      setGranularity("month");
    }
  }, [viewMode]);

  const { data: employees } = useSuspenseQuery({
    ...employeeKeys.list({ includeInactive: false }),
    staleTime: 5 * 60 * 1000,
  });

  const activeEmployees = employees.filter(
    (emp) => emp.status === "ACTIVE" && emp.salaryType !== "FIXED",
  );

  const employeeOptions = activeEmployees.map((emp) => ({
    id: emp.id,
    label: emp.full_name,
  }));

  // 2. Report Query
  const dateParams = (() => {
    let start = startDate;
    let end = endDate;

    if (viewMode === "month") {
      if (!selectedMonth) {
        return null;
      }
      start = dayjs(`${selectedMonth}-01`).startOf("month").format(DATE_FORMAT);
      end = dayjs(`${selectedMonth}-01`).endOf("month").format(DATE_FORMAT);
    } else if (viewMode === "all") {
      const available = [...monthsWithData].toSorted((a, b) => a.localeCompare(b));
      if (available.length > 0) {
        start = dayjs(`${available[0]}-01`).startOf("month").format(DATE_FORMAT);
        end = dayjs(`${available.at(-1)}-01`)
          .endOf("month")
          .format(DATE_FORMAT);
      } else {
        start = dayjs().subtract(1, "year").format(DATE_FORMAT);
        end = dayjs().format(DATE_FORMAT);
      }
    }
    return { end, start };
  })();

  const isQueryEnabled = isReportEnabled && selectedEmployeeIds.length > 0 && dateParams !== null;

  const {
    data: reportData = [],
    error,
    isLoading: loading,
  } = useQuery<EmployeeWorkData[]>({
    enabled: isQueryEnabled,
    queryFn: async () => {
      // biome-ignore lint/style/noNonNullAssertion: protected by enabled check
      const entries = await fetchGlobalTimesheetRange(dateParams!.start, dateParams!.end);
      return processRawEntries(
        entries as unknown as RawTimesheetEntry[],
        selectedEmployeeIds,
        employees,
      );
    },
    queryKey: ["reports-data", dateParams, selectedEmployeeIds, timestamp, employees],
  });

  const handleGenerateReport = () => {
    setIsReportEnabled(true);
    setTimestamp(Date.now());
  };

  const handleEmployeeToggle = (employeeId: number) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      }
      return [...prev, employeeId];
    });
  };

  const handleSelectAll = () => {
    if (activeEmployees.length === selectedEmployeeIds.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(activeEmployees.map((e) => e.id));
    }
  };

  const chartData = reportData.length > 0 ? prepareComparisonData(reportData, granularity) : [];

  const periodCount = (() => {
    if (!dateParams) {
      return 1;
    }
    const start = dayjs(dateParams.start);
    const end = dayjs(dateParams.end);
    let count = 1;
    if (granularity === "day") {
      count = end.diff(start, "day") + 1;
    } else if (granularity === "week") {
      count = end.diff(start, "week", true);
    } else {
      count = end.diff(start, "month", true);
    }
    return Math.max(1, Math.ceil(count));
  })();

  const stats = calculateStats(reportData, periodCount);

  const columns = getHRReportsColumns();

  const meta: HRReportsTableMeta = {
    totals: {
      totalDays: reportData.reduce((acc: number, e: EmployeeWorkData) => acc + e.totalDays, 0),
      totalHours: stats?.totalHours ?? 0,
    },
  };

  if (!canView) {
    return <Alert variant="error">No tienes permisos para ver reportería.</Alert>;
  }

  return (
    <section className={PAGE_CONTAINER}>
      <div className="grid gap-6 lg:grid-cols-12">
        <ReportsFiltersPanel
          activeEmployees={activeEmployees}
          employeeOptions={employeeOptions}
          error={error}
          granularity={granularity}
          handleEmployeeToggle={handleEmployeeToggle}
          handleGenerateReport={handleGenerateReport}
          handleSelectAll={handleSelectAll}
          loading={loading}
          months={months}
          monthsWithData={monthsWithData}
          selectedEmployeeIds={selectedEmployeeIds}
          selectedMonth={selectedMonth}
          setEndDate={setEndDate}
          setGranularity={setGranularity}
          setSelectedEmployeeIds={setSelectedEmployeeIds}
          setSelectedMonth={setSelectedMonth}
          setStartDate={setStartDate}
          setViewMode={setViewMode}
          startDate={startDate}
          endDate={endDate}
          viewMode={viewMode}
        />

        <ReportsResultsPanel
          chartData={chartData}
          columns={columns}
          granularity={granularity}
          granularityLabel={granularityLabel}
          loading={loading}
          meta={meta}
          reportData={reportData}
          stats={stats}
        />
      </div>
    </section>
  );
}
// ---------------------------------

function ReportsFiltersPanel({
  activeEmployees,
  employeeOptions,
  endDate,
  error,
  granularity,
  handleEmployeeToggle,
  handleGenerateReport,
  handleSelectAll,
  loading,
  months,
  monthsWithData,
  selectedEmployeeIds,
  selectedMonth,
  setEndDate,
  setGranularity,
  setSelectedEmployeeIds,
  setSelectedMonth,
  setStartDate,
  setViewMode,
  startDate,
  viewMode,
}: {
  activeEmployees: Employee[];
  employeeOptions: Array<{ id: number; label: string }>;
  endDate: string;
  error: unknown;
  granularity: ReportGranularity;
  handleEmployeeToggle: (employeeId: number) => void;
  handleGenerateReport: () => void;
  handleSelectAll: () => void;
  loading: boolean;
  months: string[];
  monthsWithData: Set<string>;
  selectedEmployeeIds: number[];
  selectedMonth: string;
  setEndDate: (value: string) => void;
  setGranularity: (value: ReportGranularity) => void;
  setSelectedEmployeeIds: (value: number[]) => void;
  setSelectedMonth: (value: string) => void;
  setStartDate: (value: string) => void;
  setViewMode: (value: ViewMode) => void;
  startDate: string;
  viewMode: ViewMode;
}) {
  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;

  return (
    <div className="space-y-6 lg:col-span-4">
      <div className="space-y-6 rounded-2xl border border-default-100 bg-background p-5 shadow-sm">
        <div className="flex items-center gap-2 border-default-100 border-b pb-2">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Configuración</h2>
        </div>

        <Tabs
          selectedKey={viewMode}
          onSelectionChange={(key) => setViewMode(key as ViewMode)}
          variant="secondary"
          className="w-full"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Vista del reporte" className="rounded-lg bg-default-50/50 p-1">
              <Tabs.Tab id="month">
                Mensual
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="range">
                Rango
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="all">
                Todo
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        <div className="space-y-4">
          {viewMode === "month" && (
            <div className="space-y-2">
              <Select
                label="Seleccionar mes"
                className="w-full"
                selectedKey={selectedMonth}
                onSelectionChange={(key) => setSelectedMonth(key ? String(key) : "")}
              >
                {months.map((month) => (
                  <SelectItem id={month} key={month}>
                    {dayjs(`${month}-01`).format("MMMM YYYY")}{" "}
                    {monthsWithData.has(month) ? "✓" : ""}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          {viewMode === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <DateField
                  className="w-full"
                  onChange={(val) => setStartDate(val ? val.toString() : "")}
                  value={startDate ? parseDate(startDate) : null}
                >
                  <Label>Desde</Label>
                  <DateInputGroup>
                    <DateInputGroup.Input>
                      {(segment) => <DateInputGroup.Segment segment={segment} />}
                    </DateInputGroup.Input>
                  </DateInputGroup>
                </DateField>
              </div>
              <div className="space-y-2">
                <DateField
                  className="w-full"
                  onChange={(val) => setEndDate(val ? val.toString() : "")}
                  value={endDate ? parseDate(endDate) : null}
                >
                  <Label>Hasta</Label>
                  <DateInputGroup>
                    <DateInputGroup.Input>
                      {(segment) => <DateInputGroup.Segment segment={segment} />}
                    </DateInputGroup.Input>
                  </DateInputGroup>
                </DateField>
              </div>
            </div>
          )}

          {viewMode === "all" && (
            <Alert className="text-sm" variant="info">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Se analizará todo el historial disponible en la base de datos.</span>
              </div>
            </Alert>
          )}

          <div className="space-y-2">
            <Select
              label="Agrupación temporal"
              className="w-full"
              selectedKey={granularity}
              onSelectionChange={(key) => {
                if (key) {
                  setGranularity(key.toString() as ReportGranularity);
                }
              }}
            >
              <SelectItem id="day" key="day">
                Diaria
              </SelectItem>
              <SelectItem id="week" key="week">
                Semanal
              </SelectItem>
              <SelectItem id="month" key="month">
                Mensual
              </SelectItem>
            </Select>
          </div>
        </div>

        <Separator className="my-2" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Empleados ({selectedEmployeeIds.length})</span>
            <Button
              size="sm"
              variant="ghost"
              onPress={handleSelectAll}
              className="text-primary text-xs"
            >
              {selectedEmployeeIds.length === activeEmployees.length ? "Ninguno" : "Todos"}
            </Button>
          </div>

          {selectedEmployeeIds.length > 0 && (
            <div className="custom-scrollbar flex max-h-32 flex-wrap gap-1.5 overflow-y-auto p-1">
              {selectedEmployeeIds.slice(0, 10).map((id) => {
                const emp = activeEmployees.find((e) => e.id === id);
                if (!emp) {
                  return null;
                }
                return (
                  <Chip
                    className="gap-1 py-3 text-xs"
                    color="accent"
                    key={id}
                    size="sm"
                    variant="primary"
                  >
                    <span className="max-w-25 truncate">
                      {emp.person?.names.split(" ")[0] ?? emp.full_name}
                    </span>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        handleEmployeeToggle(id);
                      }}
                      className="h-5 w-5 min-w-5 text-white/80"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Chip>
                );
              })}
              {selectedEmployeeIds.length > 10 && (
                <Chip className="py-3 text-xs" size="sm" variant="secondary">
                  +{selectedEmployeeIds.length - 10} más
                </Chip>
              )}
            </div>
          )}

          <EmployeeMultiSelectPopover
            buttonLabel="Seleccionar empleados..."
            onChange={setSelectedEmployeeIds}
            options={employeeOptions}
            selectedIds={selectedEmployeeIds}
            className="w-full"
          />
        </div>

        <Button
          className="mt-4 w-full shadow-md shadow-primary/20"
          disabled={selectedEmployeeIds.length === 0 || loading}
          onClick={handleGenerateReport}
          variant="primary"
        >
          {loading ? (
            <>
              <Spinner size="sm" />
              Analizando...
            </>
          ) : (
            "Generar Informe"
          )}
        </Button>

        {errorMessage && (
          <Alert className="text-xs" variant="error">
            {errorMessage}
          </Alert>
        )}
      </div>
    </div>
  );
}

function ReportsResultsPanel({
  chartData,
  columns,
  granularity,
  granularityLabel,
  loading,
  meta,
  reportData,
  stats,
}: {
  chartData: ReturnType<typeof prepareComparisonData>;
  columns: ReturnType<typeof getHRReportsColumns>;
  granularity: ReportGranularity;
  granularityLabel: string;
  loading: boolean;
  meta: HRReportsTableMeta;
  reportData: EmployeeWorkData[];
  stats: ReturnType<typeof calculateStats>;
}) {
  return (
    <div className="space-y-6 lg:col-span-8">
      {reportData.length === 0 && !loading ? (
        <div className="flex min-h-65 flex-col items-center justify-center rounded-3xl border-2 border-default-200 border-dashed bg-default-50/50 p-6 text-center sm:min-h-100 sm:p-8">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-default-50 sm:mb-6 sm:h-20 sm:w-20">
            <BarChart2 className="h-9 w-9 text-default-200 sm:h-10 sm:w-10" />
          </div>
          <h3 className="font-bold text-foreground text-lg sm:text-xl">Sin datos para mostrar</h3>
          <p className="mt-2 max-w-sm text-default-500 text-sm sm:text-base">
            Selecciona el periodo y los empleados que deseas analizar para generar gráficas y
            estadísticas detalladas.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              className="text-primary"
              icon={Clock}
              title="TOTAL HORAS"
              value={stats?.totalHours ?? 0}
            />

            <StatCard
              className="text-secondary"
              icon={BarChart3}
              subtitle={`Por ${granularityLabel}`}
              title="PROMEDIO"
              value={stats?.averageHours ?? 0}
            />

            <StatCard
              className="text-accent"
              icon={Calendar}
              subtitle="Total asistencias"
              title="DÍAS TRAB."
              value={reportData.reduce((acc, e) => acc + e.totalDays, 0)}
            />

            <StatCard
              className="text-success"
              icon={TrendingUp}
              subtitle="Horas/día asis."
              suffix="h"
              title="PROM. DIARIO"
              value={(() => {
                if (reportData.length === 0) {
                  return 0;
                }
                const avg =
                  reportData.reduce((acc, e) => acc + e.avgDailyMinutes, 0) /
                  reportData.length /
                  60;
                return Number.parseFloat(avg.toFixed(1));
              })()}
            />
          </div>

          <Suspense
            fallback={
              <div className="flex h-96 items-center justify-center rounded-3xl border border-default-100 bg-background shadow-sm">
                <Spinner className="text-primary" color="current" size="lg" />
              </div>
            }
          >
            <TemporalChart
              chartData={chartData}
              granularity={granularity}
              reportData={reportData}
            />
          </Suspense>

          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense
              fallback={
                <div className="flex h-80 items-center justify-center rounded-3xl border border-default-100 bg-background shadow-sm">
                  <Spinner className="text-secondary" color="current" size="md" />
                </div>
              }
            >
              <DistributionChart reportData={reportData} />
            </Suspense>

            <div
              className={cn(
                "flex flex-col rounded-3xl border border-default-100 bg-background p-6 shadow-sm",
                reportData.length <= 1 && "lg:col-span-2",
              )}
            >
              <h3 className="mb-4 flex items-center gap-2 font-bold text-lg">
                <List className="h-5 w-5 text-accent" />
                Detalle Numérico
              </h3>
              <DataTable
                columns={columns}
                data={reportData}
                containerVariant="plain"
                enablePagination={false}
                enableToolbar={false}
                enableVirtualization={false}
                meta={meta as unknown as Record<string, unknown>}
                noDataMessage="No hay datos para mostrar."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function processRawEntries(
  entries: RawTimesheetEntry[],
  employeeIds: number[],
  employees: Employee[],
): EmployeeWorkData[] {
  const map = new Map<number, EmployeeWorkData>();

  // Init map
  for (const id of employeeIds) {
    const emp = employees.find((e) => e.id === id);
    if (emp) {
      map.set(id, {
        avgDailyMinutes: 0,
        dailyBreakdown: {},
        employeeId: id,
        fullName: emp.full_name,
        monthlyBreakdown: {},
        overtimePercentage: 0,
        role: emp.position,
        totalDays: 0,
        totalMinutes: 0,
        totalOvertimeMinutes: 0,
        weeklyBreakdown: {},
      });
    }
  }

  for (const entry of entries) {
    if (!map.has(entry.employee_id)) {
      continue;
    }
    // biome-ignore lint/style/noNonNullAssertion: checked by map.has
    const data = map.get(entry.employee_id)!;

    data.totalMinutes += entry.worked_minutes;
    data.totalOvertimeMinutes += entry.overtime_minutes;

    // Daily
    const dateKey = dayjs(entry.work_date, DATE_FORMAT).format(DATE_FORMAT);
    const currentDaily = data.dailyBreakdown[dateKey] ?? 0;
    Object.assign(data.dailyBreakdown, { [dateKey]: currentDaily + entry.worked_minutes });

    // Weekly
    const weekKey = dayjs(entry.work_date, DATE_FORMAT).startOf("isoWeek").format(DATE_FORMAT);
    const currentWeekly = data.weeklyBreakdown[weekKey] ?? 0;
    Object.assign(data.weeklyBreakdown, { [weekKey]: currentWeekly + entry.worked_minutes });

    // Monthly
    const monthKey = dayjs(entry.work_date, DATE_FORMAT).format("YYYY-MM");
    const currentMonthly = data.monthlyBreakdown[monthKey] ?? 0;
    Object.assign(data.monthlyBreakdown, { [monthKey]: currentMonthly + entry.worked_minutes });
  }

  // Stats
  for (const data of map.values()) {
    const uniqueDays = Object.keys(data.dailyBreakdown).length;
    data.totalDays = uniqueDays;
    data.avgDailyMinutes = uniqueDays > 0 ? Math.round(data.totalMinutes / uniqueDays) : 0;
    data.overtimePercentage =
      data.totalMinutes > 0
        ? Number.parseFloat(((data.totalOvertimeMinutes / data.totalMinutes) * 100).toFixed(1))
        : 0;
  }

  return [...map.values()];
}
