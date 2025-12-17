import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/es";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Filter,
  Search,
  X,
  Check,
  Calendar,
  BarChart2,
  List,
  Clock,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  type LucideIcon,
} from "lucide-react";
import { LOADING_SPINNER_SM } from "@/lib/styles";

import { useAuth } from "@/context/AuthContext";
import { fetchEmployees } from "@/features/hr/employees/api";
import type { Employee } from "@/features/hr/employees/types";
import { useMonths } from "@/features/hr/timesheets/hooks/useMonths";
import { fetchGlobalTimesheetRange } from "../api";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { prepareComparisonData, calculateStats, minutesToTime } from "../utils";
import type { EmployeeWorkData, ReportGranularity } from "../types";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";
import { cn } from "@/lib/utils";

dayjs.extend(isoWeek);
dayjs.locale("es");

// Local Stat Card Component for Report specific metrics
function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  className,
  suffix,
}: {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  className?: string;
  suffix?: string;
}) {
  return (
    <div className="bg-base-100 border-base-200 relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between">
        <span className="text-base-content/50 text-xs font-bold tracking-wider uppercase">{title}</span>
        <div
          className={cn(
            "bg-base-200/50 rounded-full p-2",
            className?.replace("text-", "bg-").replace("500", "100") + "/10"
          )}
        >
          <Icon className={cn("h-4 w-4", className)} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-2xl font-black tracking-tight", className)}>{value}</span>
        {suffix && <span className="text-base-content/40 text-sm font-medium">{suffix}</span>}
      </div>
      {subtext && (
        <div className="text-base-content/60 mt-1 truncate text-xs" title={subtext}>
          {subtext}
        </div>
      )}
    </div>
  );
}

// Color palette with fallbacks
const getChartColors = (): string[] => {
  const defaultColors = [
    "hsl(220 70% 50%)", // Blue
    "hsl(160 70% 40%)", // Emerald
    "hsl(30 80% 55%)", // Orange
    "hsl(340 75% 55%)", // Pink
    "hsl(270 70% 60%)", // Purple
    "hsl(190 80% 40%)", // Cyan
    "hsl(10 80% 55%)", // Red
    "hsl(290 70% 55%)", // Magenta
  ];

  if (typeof window === "undefined") return defaultColors;

  try {
    const root = window.getComputedStyle(document.documentElement);
    const getVar = (name: string) => {
      const val = root.getPropertyValue(name).trim();
      return val ? `hsl(${val})` : null;
    };

    const themeColors = [
      getVar("--p"),
      getVar("--s"),
      getVar("--a"),
      getVar("--n"),
      getVar("--in"),
      getVar("--su"),
      getVar("--wa"),
      getVar("--er"),
    ].filter(Boolean) as string[];

    return themeColors.length > 0 ? themeColors : defaultColors;
  } catch (e) {
    return defaultColors;
  }
};

type ViewMode = "month" | "range" | "all";

export default function ReportsPage() {
  const { can } = useAuth();
  const canView = can("read", "Report");

  // Data loading
  const { months, monthsWithData } = useMonths();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [, setLoadingEmployees] = useState(true); // removed loadingEmployees usage warning

  // Selection state
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(() => dayjs().startOf("month").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState<string>(() => dayjs().endOf("month").format("YYYY-MM-DD"));

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [granularity, setGranularity] = useState<ReportGranularity>("month");

  // UI State
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Data state
  const [reportData, setReportData] = useState<EmployeeWorkData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the actual date range used for the current report data to calculate stats correctly
  const [effectiveDateRange, setEffectiveDateRange] = useState<{ start: string; end: string } | null>(null);

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

  // Set default month
  useEffect(() => {
    if (months.length && !selectedMonth) {
      setSelectedMonth(months[0] ?? "");
    }
  }, [months, selectedMonth]);

  // Set granularity based on mode
  useEffect(() => {
    if (viewMode === "month") setGranularity("week");
    else if (viewMode === "all") setGranularity("month");
  }, [viewMode]);

  // Core processing logic for raw entries
  interface RawTimesheetEntry {
    employee_id: number;
    work_date: string;
    worked_minutes: number;
    overtime_minutes: number;
    // other fields if needed
  }

  const processRawEntries = useCallback(
    (entries: RawTimesheetEntry[], employeeIds: number[]) => {
      const map = new Map<number, EmployeeWorkData>();

      // Init map for selected employees
      employeeIds.forEach((id) => {
        const emp = employees.find((e) => e.id === id);
        if (emp) {
          map.set(id, {
            employeeId: id,
            fullName: emp.full_name,
            role: emp.position,
            totalMinutes: 0,
            totalOvertimeMinutes: 0,
            totalDays: 0,
            avgDailyMinutes: 0,
            overtimePercentage: 0,
            dailyBreakdown: {},
            weeklyBreakdown: {},
            monthlyBreakdown: {},
          });
        }
      });

      // Populate data
      entries.forEach((entry) => {
        if (!map.has(entry.employee_id)) return;
        const data = map.get(entry.employee_id)!;

        data.totalMinutes += entry.worked_minutes;
        data.totalOvertimeMinutes += entry.overtime_minutes;

        // Daily
        const dateKey = entry.work_date;
        data.dailyBreakdown[dateKey] = (data.dailyBreakdown[dateKey] || 0) + entry.worked_minutes;

        // Weekly
        const weekKey = dayjs(entry.work_date).startOf("isoWeek").format("YYYY-MM-DD");
        data.weeklyBreakdown[weekKey] = (data.weeklyBreakdown[weekKey] || 0) + entry.worked_minutes;

        // Monthly
        const monthKey = dayjs(entry.work_date).format("YYYY-MM");
        data.monthlyBreakdown[monthKey] = (data.monthlyBreakdown[monthKey] || 0) + entry.worked_minutes;
      });

      return Array.from(map.values());
    },
    [employees]
  );

  // Load report data
  const handleGenerateReport = useCallback(async () => {
    if (selectedEmployeeIds.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      let data: EmployeeWorkData[] = [];

      if (viewMode === "month") {
        if (!selectedMonth) return;
        // Fetch raw detail for the month to support granular charts
        const start = dayjs(`${selectedMonth}-01`).startOf("month").format("YYYY-MM-DD");
        const end = dayjs(`${selectedMonth}-01`).endOf("month").format("YYYY-MM-DD");
        const entries = await fetchGlobalTimesheetRange(start, end);
        data = processRawEntries(entries, selectedEmployeeIds);
        setEffectiveDateRange({ start, end });
      } else {
        let start = startDate;
        let end = endDate;

        if (viewMode === "all") {
          const available = Array.from(monthsWithData).sort();
          if (available.length > 0) {
            start = dayjs(`${available[0]}-01`).startOf("month").format("YYYY-MM-DD");
            end = dayjs(`${available[available.length - 1]}-01`)
              .endOf("month")
              .format("YYYY-MM-DD");
          } else {
            // Fallback
            start = dayjs().subtract(1, "year").format("YYYY-MM-DD");
            end = dayjs().format("YYYY-MM-DD");
          }
        }

        const entries = await fetchGlobalTimesheetRange(start, end);
        data = processRawEntries(entries, selectedEmployeeIds);
        setEffectiveDateRange({ start, end });
      }

      setReportData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al generar el reporte";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedMonth, startDate, endDate, selectedEmployeeIds, monthsWithData, processRawEntries]);

  const handleEmployeeToggle = useCallback((employeeId: number) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) return prev.filter((id) => id !== employeeId);
      return [...prev, employeeId];
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (filteredEmployees.length === selectedEmployeeIds.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((e) => e.id));
    }
  }, [filteredEmployees, selectedEmployeeIds]);

  // Prepare chart data
  const chartData = useMemo(
    () => (reportData.length > 0 ? prepareComparisonData(reportData, granularity) : []),
    [reportData, granularity]
  );

  // Calculate period count for stats based on granularity
  const periodCount = useMemo(() => {
    if (!effectiveDateRange) return 1;

    const start = dayjs(effectiveDateRange.start);
    const end = dayjs(effectiveDateRange.end);

    // exact diff
    let count = 1;
    if (granularity === "day") {
      count = end.diff(start, "day") + 1;
    } else if (granularity === "week") {
      count = end.diff(start, "week", true);
    } else {
      count = end.diff(start, "month", true);
    }

    return Math.max(1, Math.ceil(count));
  }, [effectiveDateRange, granularity]);

  const stats = useMemo(() => calculateStats(reportData, periodCount), [reportData, periodCount]);
  const chartColors = getChartColors();

  if (!canView) {
    return <Alert variant="error">No tienes permisos para ver reportería.</Alert>;
  }

  return (
    <section className={PAGE_CONTAINER}>
      {/* Header */}
      <header>
        <h1 className={TITLE_LG}>Reportería y Análisis</h1>
        <p className="text-base-content/70 mt-1 text-sm">
          Visualiza tendencias, compara desempeño y exporta datos históricos
        </p>
      </header>

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
            <div role="tablist" className="tabs tabs-boxed bg-base-200/50 p-1">
              <a
                role="tab"
                className={cn(
                  "tab transition-all duration-200",
                  viewMode === "month" && "tab-active bg-white shadow-sm"
                )}
                onClick={() => setViewMode("month")}
              >
                Mensual
              </a>
              <a
                role="tab"
                className={cn(
                  "tab transition-all duration-200",
                  viewMode === "range" && "tab-active bg-white shadow-sm"
                )}
                onClick={() => setViewMode("range")}
              >
                Rango
              </a>
              <a
                role="tab"
                className={cn("tab transition-all duration-200", viewMode === "all" && "tab-active bg-white shadow-sm")}
                onClick={() => setViewMode("all")}
              >
                Todo
              </a>
            </div>

            {/* Date Controls */}
            <div className="space-y-4">
              {viewMode === "month" && (
                <div className="form-control">
                  <label className="label text-sm font-medium">Seleccionar Mes</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="select select-bordered w-full"
                  >
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {dayjs(`${month}-01`).format("MMMM YYYY")} {monthsWithData.has(month) ? "✓" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {viewMode === "range" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label text-sm font-medium">Desde</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label text-sm font-medium">Hasta</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full"
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
                <label className="label text-sm font-medium">Agrupación temporal</label>
                <select
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value as ReportGranularity)}
                  className="select select-bordered w-full"
                >
                  <option value="day">Diaria</option>
                  <option value="week">Semanal</option>
                  <option value="month">Mensual</option>
                </select>
              </div>
            </div>

            <div className="divider my-2"></div>

            {/* Employee Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Empleados ({selectedEmployeeIds.length})</label>
                <button onClick={handleSelectAll} className="link link-primary text-xs no-underline hover:underline">
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
                      <div key={id} className="badge badge-primary badge-sm gap-1 py-3 text-xs">
                        {/* Fix: use fatherName derived or just fallback, keeping it simple */}
                        <span className="max-w-25 truncate">{emp.person?.names.split(" ")[0] ?? emp.full_name}</span>
                        <button
                          onClick={() => setSelectedEmployeeIds((p) => p.filter((x) => x !== id))}
                          className="hover:text-white/80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                  {selectedEmployeeIds.length > 10 && (
                    <div className="badge badge-ghost badge-sm py-3 text-xs">
                      +{selectedEmployeeIds.length - 10} más
                    </div>
                  )}
                </div>
              )}

              {/* Add Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="btn btn-outline btn-sm w-full justify-between font-normal"
                  onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                >
                  <span>Seleccionar empleados...</span>
                  <Search className="h-3.5 w-3.5 opacity-50" />
                </button>

                {showEmployeeDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowEmployeeDropdown(false)} />
                    <div className="bg-base-100 border-base-200 absolute top-full right-0 left-0 z-50 mt-2 flex max-h-80 flex-col overflow-hidden rounded-xl border shadow-xl">
                      <div className="border-base-200 bg-base-50 border-b p-2">
                        <label className="input input-sm input-bordered flex items-center gap-2 bg-white">
                          <Search className="h-4 w-4 opacity-50" />
                          <input
                            type="text"
                            className="grow"
                            placeholder="Buscar..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            autoFocus
                          />
                        </label>
                      </div>
                      <div className="overflow-y-auto p-1">
                        {filteredEmployees.map((emp) => {
                          const isSelected = selectedEmployeeIds.includes(emp.id);
                          return (
                            <button
                              key={emp.id}
                              onClick={() => handleEmployeeToggle(emp.id)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                isSelected
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "hover:bg-base-200 text-base-content"
                              )}
                            >
                              <span className="truncate">{emp.full_name}</span>
                              {isSelected && <Check className="ml-2 h-4 w-4" />}
                            </button>
                          );
                        })}
                        {filteredEmployees.length === 0 && (
                          <div className="text-base-content/50 p-4 text-center text-sm">No hay resultados</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Button
              variant="primary"
              className="shadow-primary/20 mt-4 w-full shadow-md"
              onClick={handleGenerateReport}
              disabled={selectedEmployeeIds.length === 0 || loading}
            >
              {loading ? (
                <>
                  <span className={LOADING_SPINNER_SM} />
                  Analizando...
                </>
              ) : (
                "Generar Informe"
              )}
            </Button>

            {error && (
              <Alert variant="error" className="text-xs">
                {error}
              </Alert>
            )}
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="space-y-6 lg:col-span-8">
          {reportData.length === 0 ? (
            <div className="border-base-300 bg-base-50/50 flex h-full min-h-100 flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center">
              <div className="bg-base-200 mb-6 flex h-20 w-20 items-center justify-center rounded-full">
                <BarChart2 className="text-base-content/30 h-10 w-10" />
              </div>
              <h3 className="text-base-content text-xl font-bold">Sin datos para mostrar</h3>
              <p className="text-base-content/60 mt-2 max-w-sm">
                Selecciona el periodo y los empleados que deseas analizar para generar gráficas y estadísticas
                detalladas.
              </p>
            </div>
          ) : (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard title="TOTAL HORAS" value={stats?.totalHours ?? 0} icon={Clock} className="text-primary" />
                <StatCard
                  title="PROMEDIO"
                  value={stats?.averageHours ?? 0}
                  icon={BarChart3}
                  className="text-secondary"
                  subtext={`Por ${granularity === "month" ? "mes" : granularity === "week" ? "sem" : "día"}`}
                />
                <StatCard
                  title="DÍAS TRAB."
                  value={reportData.reduce((acc, e) => acc + e.totalDays, 0)}
                  icon={Calendar}
                  className="text-accent"
                  subtext="Total asistencias"
                />
                <StatCard
                  title="PROM. DIARIO"
                  value={
                    reportData.length
                      ? parseFloat(
                          (reportData.reduce((acc, e) => acc + e.avgDailyMinutes, 0) / reportData.length / 60).toFixed(
                            1
                          )
                        )
                      : 0
                  }
                  suffix="h"
                  icon={TrendingUp}
                  className="text-success"
                  subtext="Horas/día asis."
                />
              </div>

              {/* Main Chart */}
              <div className="bg-base-100 border-base-200 rounded-3xl border p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    <BarChart2 className="text-primary h-5 w-5" />
                    Comparativa Temporal
                  </h3>
                  <div className="badge badge-outline text-xs">
                    {granularity === "day" ? "Diario" : granularity === "week" ? "Semanal" : "Mensual"}
                  </div>
                </div>

                <div className="w-full" style={{ height: 350, minHeight: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {granularity === "month" ? (
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="hsl(var(--bc) / 0.4)" />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--bc) / 0.4)" />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px hsl(var(--b3) / 0.5)",
                          }}
                          cursor={{ fill: "hsl(var(--bc) / 0.05)" }}
                        />
                        <Legend />
                        {reportData.map((emp, idx) => (
                          <Bar
                            key={emp.employeeId}
                            dataKey={emp.fullName}
                            fill={chartColors[idx % chartColors.length]}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={50}
                          />
                        ))}
                      </BarChart>
                    ) : (
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="hsl(var(--bc) / 0.4)" />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--bc) / 0.4)" />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px hsl(var(--b3) / 0.5)",
                          }}
                          cursor={{ fill: "hsl(var(--bc) / 0.05)" }}
                        />
                        <Legend iconType="circle" />
                        {reportData.map((emp, idx) => (
                          <Line
                            key={emp.employeeId}
                            type="monotone"
                            dataKey={emp.fullName}
                            stroke={chartColors[idx % chartColors.length]}
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Secondary Details Grid */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Pie Chart */}
                {reportData.length > 1 && (
                  <div className="bg-base-100 border-base-200 rounded-3xl border p-6 shadow-sm">
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
                      <PieChartIcon className="text-secondary h-5 w-5" />
                      Distribución Total
                    </h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportData.map((emp) => ({
                              name: emp.fullName,
                              value: parseFloat((emp.totalMinutes / 60).toFixed(1)),
                            }))}
                            cx="50%"
                            cy="45%"
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {reportData.map((_, idx) => (
                              <Cell
                                key={`cell-${idx}`}
                                fill={chartColors[idx % chartColors.length]}
                                stroke="hsl(var(--b1))"
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: "12px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px hsl(var(--b3) / 0.5)",
                            }}
                          />
                          <Legend verticalAlign="bottom" align="center" height={70} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Detailed Table */}
                <div
                  className={cn(
                    "bg-base-100 border-base-200 flex flex-col rounded-3xl border p-6 shadow-sm",
                    reportData.length <= 1 && "lg:col-span-2"
                  )}
                >
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
                    <List className="text-accent h-5 w-5" />
                    Detalle Numérico
                  </h3>
                  <div className="grow overflow-x-auto">
                    <table className="table-sm table">
                      <thead>
                        <tr className="border-base-200 text-base-content/60 border-b">
                          <th>Empleado</th>
                          <th className="text-right">Días</th>
                          <th className="text-right">Diario</th>
                          <th className="text-right">Horas</th>
                          <th className="text-right">Ext.</th>
                          <th className="text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((emp) => (
                          <tr key={emp.employeeId} className="hover:bg-base-50/50 border-0 transition-colors">
                            <td className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="bg-primary/20 h-6 w-1 rounded-full"></div>
                                <div>
                                  <div className="font-bold">{emp.fullName}</div>
                                  <div className="text-[10px] tracking-widest uppercase opacity-50">{emp.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="text-right font-medium">{emp.totalDays}</td>
                            <td className="text-right font-mono">{minutesToTime(emp.avgDailyMinutes)}</td>
                            <td className="text-right font-mono text-base">
                              {parseFloat((emp.totalMinutes / 60).toFixed(1))}
                            </td>
                            <td className="text-warning text-right font-mono text-base">
                              {parseFloat((emp.totalOvertimeMinutes / 60).toFixed(1))}
                            </td>
                            <td className="text-right text-xs">
                              {emp.overtimePercentage > 0 ? (
                                <span className="badge badge-sm badge-ghost">{emp.overtimePercentage}%</span>
                              ) : (
                                <span className="text-base-content/30">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-base-200 border-t-2 border-double">
                        <tr className="text-base-content font-bold">
                          <td>Total</td>
                          <td className="text-right">{reportData.reduce((acc, e) => acc + e.totalDays, 0)}</td>
                          <td className="text-right">-</td>
                          <td className="text-right">{stats?.totalHours}</td>
                          <td className="text-right">-</td>
                          <td className="text-right"></td>
                        </tr>
                      </tfoot>
                    </table>
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
