import { Chip, ListBox, Select, Spinner } from "@heroui/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import {
  BarChart2,
  BarChart3,
  Calendar,
  Check,
  Clock,
  Filter,
  List,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StatCard from "@/components/ui/StatCard";
import { useAuth } from "@/context/AuthContext";
import { fetchEmployees } from "@/features/hr/employees/api";
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
  work_date: string;
  worked_minutes: number;
}

type ViewMode = "all" | "month" | "range";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy component
export default function ReportsPage() {
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
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
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
    if (viewMode === "month") setGranularity("week");
    else if (viewMode === "all") setGranularity("month");
  }, [viewMode]);

  const { data: employees } = useSuspenseQuery({
    queryFn: () => fetchEmployees(false),
    queryKey: ["employees-list"],
    staleTime: 5 * 60 * 1000,
  });

  const activeEmployees = employees.filter(
    (emp) => emp.status === "ACTIVE" && emp.salaryType !== "FIXED",
  );

  const filteredEmployees = (() => {
    if (!employeeSearch.trim()) return activeEmployees;
    const search = employeeSearch.toLowerCase();
    return activeEmployees.filter((emp) => emp.full_name.toLowerCase().includes(search));
  })();

  // 2. Report Query
  const dateParams = (() => {
    let start = startDate;
    let end = endDate;

    if (viewMode === "month") {
      if (!selectedMonth) return null;
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
      if (prev.includes(employeeId)) return prev.filter((id) => id !== employeeId);
      return [...prev, employeeId];
    });
  };

  const handleSelectAll = () => {
    if (filteredEmployees.length === selectedEmployeeIds.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((e) => e.id));
    }
  };

  const chartData = reportData.length > 0 ? prepareComparisonData(reportData, granularity) : [];

  const periodCount = (() => {
    if (!dateParams) return 1;
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
      {/* Main Controls */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Filters */}
        <div className="space-y-6 lg:col-span-4">
          <div className="bg-base-100 border-base-200 space-y-6 rounded-2xl border p-5 shadow-sm">
            <div className="border-base-200 flex items-center gap-2 border-b pb-2">
              <Filter className="text-primary h-5 w-5" />
              <h2 className="text-lg font-semibold">Configuración</h2>
            </div>

            {/* View Mode Tabs */}
            <div className="tabs tabs-boxed bg-base-200/50 p-1" role="tablist">
              <button
                className={cn(
                  "tab transition-all duration-200",
                  viewMode === "month" && "tab-active bg-base-100 shadow-sm",
                )}
                onClick={() => {
                  setViewMode("month");
                }}
                role="tab"
                type="button"
              >
                Mensual
              </button>
              <button
                className={cn(
                  "tab transition-all duration-200",
                  viewMode === "range" && "tab-active bg-base-100 shadow-sm",
                )}
                onClick={() => {
                  setViewMode("range");
                }}
                role="tab"
                type="button"
              >
                Rango
              </button>
              <button
                className={cn(
                  "tab transition-all duration-200",
                  viewMode === "all" && "tab-active bg-base-100 shadow-sm",
                )}
                onClick={() => {
                  setViewMode("all");
                }}
                role="tab"
                type="button"
              >
                Todo
              </button>
            </div>

            {/* Date Controls */}
            <div className="space-y-4">
              {viewMode === "month" && (
                <div className="form-control">
                  <label className="label text-sm font-medium" htmlFor="month-select">
                    Seleccionar Mes
                  </label>
                  <Select
                    aria-label="Seleccionar Mes"
                    className="w-full"
                    selectedKey={selectedMonth}
                    onSelectionChange={(key) => setSelectedMonth(key ? String(key) : "")}
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
                            {dayjs(`${month}-01`).format("MMMM YYYY")}{" "}
                            {monthsWithData.has(month) ? "✓" : ""}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              )}

              {viewMode === "range" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label text-sm font-medium" htmlFor="start-date">
                      Desde
                    </label>
                    <Input
                      className="w-full"
                      id="start-date"
                      onChange={(e) => {
                        setStartDate(e.target.value);
                      }}
                      type="date"
                      value={startDate}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label text-sm font-medium" htmlFor="end-date">
                      Hasta
                    </label>
                    <Input
                      className="w-full"
                      id="end-date"
                      onChange={(e) => {
                        setEndDate(e.target.value);
                      }}
                      type="date"
                      value={endDate}
                    />
                  </div>
                </div>
              )}

              {viewMode === "all" && (
                <div className="alert bg-base-200/50 text-sm">
                  <Calendar className="text-primary h-4 w-4" />
                  <span>Se analizará todo el historial disponible en la base de datos.</span>
                </div>
              )}

              <div className="form-control">
                <label className="label text-sm font-medium" htmlFor="granularity-select">
                  Agrupación temporal
                </label>
                <Select
                  aria-label="Agrupación temporal"
                  className="w-full"
                  selectedKey={granularity}
                  onSelectionChange={(key) => {
                    if (key) setGranularity(key.toString() as ReportGranularity);
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item key="day" textValue="Diaria">
                        Diaria
                      </ListBox.Item>
                      <ListBox.Item key="week" textValue="Semanal">
                        Semanal
                      </ListBox.Item>
                      <ListBox.Item key="month" textValue="Mensual">
                        Mensual
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>

            <div className="divider my-2"></div>

            {/* Employee Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Empleados ({selectedEmployeeIds.length})
                </span>
                <button
                  className="link link-primary text-xs no-underline hover:underline"
                  onClick={handleSelectAll}
                  type="button"
                >
                  {selectedEmployeeIds.length === filteredEmployees.length ? "Ninguno" : "Todos"}
                </button>
              </div>

              {/* Selected Tags */}
              {selectedEmployeeIds.length > 0 && (
                <div className="custom-scrollbar flex max-h-32 flex-wrap gap-1.5 overflow-y-auto p-1">
                  {selectedEmployeeIds.slice(0, 10).map((id) => {
                    const emp = activeEmployees.find((e) => e.id === id);
                    if (!emp) return null;
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
                        <button
                          className="hover:text-white/80"
                          onClick={() => {
                            handleEmployeeToggle(id);
                          }}
                          type="button"
                        >
                          <X className="h-3 w-3" />
                        </button>
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

              {/* Add Dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between font-normal"
                  onPress={() => {
                    setShowEmployeeDropdown(!showEmployeeDropdown);
                  }}
                >
                  <span>Seleccionar empleados...</span>
                  <Search className="h-3.5 w-3.5 opacity-50" />
                </Button>

                {showEmployeeDropdown && (
                  <>
                    <button
                      aria-label="Cerrar búsqueda"
                      className="fixed inset-0 z-40 w-full h-full cursor-default bg-transparent"
                      onClick={() => {
                        setShowEmployeeDropdown(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setShowEmployeeDropdown(false);
                      }}
                      tabIndex={-1}
                      type="button"
                    />
                    <div className="bg-base-100 border-base-200 absolute top-full right-0 left-0 z-50 mt-2 flex max-h-80 flex-col overflow-hidden rounded-xl border shadow-xl">
                      <div className="border-base-200 bg-base-50 border-b p-2">
                        <label className="input input-sm input-bordered flex items-center gap-2 bg-white">
                          <Search className="h-4 w-4 opacity-50" />
                          <input
                            className="grow"
                            onChange={(e) => {
                              setEmployeeSearch(e.target.value);
                            }}
                            placeholder="Buscar..."
                            type="text"
                            value={employeeSearch}
                          />
                        </label>
                      </div>
                      <div className="overflow-y-auto p-1">
                        {filteredEmployees.map((emp) => {
                          const isSelected = selectedEmployeeIds.includes(emp.id);
                          return (
                            <button
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                isSelected
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-base-200 text-base-content",
                              )}
                              key={emp.id}
                              onClick={() => {
                                handleEmployeeToggle(emp.id);
                              }}
                              type="button"
                            >
                              <span className="truncate">{emp.full_name}</span>
                              {isSelected && <Check className="ml-2 h-4 w-4" />}
                            </button>
                          );
                        })}
                        {filteredEmployees.length === 0 && (
                          <div className="text-base-content/50 p-4 text-center text-sm">
                            No hay resultados
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Button
              className="shadow-primary/20 mt-4 w-full shadow-md"
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

            {error && (
              <Alert className="text-xs" variant="error">
                {error instanceof Error ? error.message : String(error)}
              </Alert>
            )}
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="space-y-6 lg:col-span-8">
          {reportData.length === 0 && !loading ? (
            <div className="border-base-300 bg-base-50/50 flex h-full min-h-100 flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center">
              <div className="bg-base-200 mb-6 flex h-20 w-20 items-center justify-center rounded-full">
                <BarChart2 className="text-base-content/30 h-10 w-10" />
              </div>
              <h3 className="text-base-content text-xl font-bold">Sin datos para mostrar</h3>
              <p className="text-base-content/60 mt-2 max-w-sm">
                Selecciona el periodo y los empleados que deseas analizar para generar gráficas y
                estadísticas detalladas.
              </p>
            </div>
          ) : (
            <>
              {/* KPI Grid */}
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
                    if (reportData.length === 0) return 0;
                    const avg =
                      reportData.reduce((acc, e) => acc + e.avgDailyMinutes, 0) /
                      reportData.length /
                      60;
                    return Number.parseFloat(avg.toFixed(1));
                  })()}
                />
              </div>

              {/* Charts Section - Lazy Loaded */}
              <Suspense
                fallback={
                  <div className="bg-base-100 border-base-200 flex h-96 items-center justify-center rounded-3xl border shadow-sm">
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

              {/* Secondary Details Grid */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Pie Chart - Lazy Loaded */}
                <Suspense
                  fallback={
                    <div className="bg-base-100 border-base-200 flex h-80 items-center justify-center rounded-3xl border shadow-sm">
                      <Spinner className="text-secondary" color="current" size="md" />
                    </div>
                  }
                >
                  <DistributionChart reportData={reportData} />
                </Suspense>

                {/* Detailed Table */}
                <div
                  className={cn(
                    "bg-base-100 border-base-200 flex flex-col rounded-3xl border p-6 shadow-sm",
                    reportData.length <= 1 && "lg:col-span-2",
                  )}
                >
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
                    <List className="text-accent h-5 w-5" />
                    Detalle Numérico
                  </h3>
                  <div className="grow overflow-x-auto">
                    <DataTable
                      columns={columns}
                      data={reportData}
                      enableToolbar={false}
                      enableVirtualization={false}
                      meta={meta as unknown as Record<string, unknown>}
                      noDataMessage="No hay datos para mostrar."
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
// ---------------------------------

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
    if (!map.has(entry.employee_id)) continue;
    // biome-ignore lint/style/noNonNullAssertion: checked by map.has
    const data = map.get(entry.employee_id)!;

    data.totalMinutes += entry.worked_minutes;
    data.totalOvertimeMinutes += entry.overtime_minutes;

    // Daily
    const dateKey = entry.work_date;
    const currentDaily = data.dailyBreakdown[dateKey] ?? 0;
    Object.assign(data.dailyBreakdown, { [dateKey]: currentDaily + entry.worked_minutes });

    // Weekly
    const weekKey = dayjs(entry.work_date).startOf("isoWeek").format(DATE_FORMAT);
    const currentWeekly = data.weeklyBreakdown[weekKey] ?? 0;
    Object.assign(data.weeklyBreakdown, { [weekKey]: currentWeekly + entry.worked_minutes });

    // Monthly
    const monthKey = dayjs(entry.work_date).format("YYYY-MM");
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
