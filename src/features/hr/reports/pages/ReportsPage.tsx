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
import { Filter, Plus, TrendingUp, X } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { fetchEmployees } from "@/features/hr/employees/api";
import type { Employee } from "@/features/hr/employees/types";
import { useMonths } from "@/features/hr/timesheets/hooks/useMonths";
import { fetchTimesheetSummary } from "@/features/hr/timesheets/api";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { prepareComparisonData, calculateStats } from "../utils";
import type { EmployeeWorkData, ReportGranularity } from "../types";

dayjs.extend(isoWeek);
dayjs.locale("es");

// Color palette mapped to DaisyUI variables
const getChartColors = (): string[] => {
  if (typeof window === "undefined") return [];
  const root = window.getComputedStyle(document.documentElement);
  return [
    `hsl(${root.getPropertyValue("--p")})`,
    `hsl(${root.getPropertyValue("--e")})`,
    `hsl(${root.getPropertyValue("--su")})`,
    `hsl(${root.getPropertyValue("--wa")})`,
    `hsl(${root.getPropertyValue("--in")})`,
    `hsl(${root.getPropertyValue("--o")})`,
  ];
};

export default function ReportsPage() {
  const { hasRole } = useAuth();
  const canView = hasRole("GOD", "ADMIN");

  // Data loading
  const { months } = useMonths();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Selection state
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [granularity, setGranularity] = useState<ReportGranularity>("month");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Data state
  const [reportData, setReportData] = useState<EmployeeWorkData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Load report data
  const handleGenerateReport = useCallback(async () => {
    if (!selectedMonth || selectedEmployeeIds.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetchTimesheetSummary(selectedMonth);

      // Map summary data to our format
      const processedData = response.employees
        .filter((emp) => selectedEmployeeIds.includes(emp.employeeId))
        .map((emp) => ({
          employeeId: emp.employeeId,
          fullName: emp.fullName,
          role: emp.role,
          totalMinutes: emp.workedMinutes,
          totalOvertimeMinutes: emp.overtimeMinutes,
          dailyBreakdown: {},
          weeklyBreakdown: {},
          monthlyBreakdown: { [selectedMonth]: emp.workedMinutes },
        }));

      setReportData(processedData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al generar el reporte";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedEmployeeIds]);

  const handleEmployeeToggle = useCallback((employeeId: number) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      }
      return [...prev, employeeId];
    });
  }, []);

  const handleRemoveEmployee = useCallback((employeeId: number) => {
    setSelectedEmployeeIds((prev) => prev.filter((id) => id !== employeeId));
  }, []);

  const handleClearEmployees = useCallback(() => {
    setSelectedEmployeeIds([]);
  }, []);

  // Prepare chart data
  const chartData = useMemo(
    () => (reportData.length > 0 ? prepareComparisonData(reportData, granularity) : []),
    [reportData, granularity]
  );

  const stats = useMemo(() => calculateStats(reportData), [reportData]);
  const chartColors = getChartColors();

  if (!canView) {
    return <Alert variant="error">No tienes permisos para ver reportería.</Alert>;
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-primary text-2xl font-bold">Reportería de horas</h1>
        <p className="text-base-content/70 mt-1 text-sm">
          Analiza horas trabajadas, compara empleados y genera reportes detallados
        </p>
      </header>

      {/* Filters */}
      <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Filter className="text-primary h-5 w-5" />
          <h2 className="text-base-content text-lg font-semibold">Filtros y opciones</h2>
        </div>

        <div className="space-y-4">
          {/* Month Selection */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-base-content mb-2 block text-sm font-medium">Mes</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="select select-bordered w-full"
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {dayjs(`${month}-01`).format("MMMM YYYY")}
                  </option>
                ))}
              </select>
            </div>

            {/* Granularity Selection */}
            <div>
              <label className="text-base-content mb-2 block text-sm font-medium">Agrupar por</label>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as ReportGranularity)}
                className="select select-bordered w-full"
              >
                <option value="day">Días</option>
                <option value="week">Semanas</option>
                <option value="month">Meses</option>
              </select>
            </div>
          </div>

          {/* Employee Selection */}
          <div>
            <label className="text-base-content mb-2 block text-sm font-medium">
              Empleados seleccionados ({selectedEmployeeIds.length})
            </label>

            {/* Selected Employees */}
            {selectedEmployeeIds.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
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
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {selectedEmployeeIds.length > 0 && (
                  <button type="button" onClick={handleClearEmployees} className="link link-error text-sm">
                    Limpiar
                  </button>
                )}
              </div>
            )}

            {/* Add Employee Dropdown */}
            <div className="relative">
              <button
                type="button"
                className="btn btn-outline btn-sm w-full justify-start gap-2"
                onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
              >
                <Plus className="h-4 w-4" />
                Agregar empleado
              </button>

              {showEmployeeDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowEmployeeDropdown(false)} />
                  <div className="border-base-300 bg-base-100 absolute top-full right-0 left-0 z-50 mt-2 rounded-xl border shadow-xl">
                    <div className="border-base-300 border-b p-3">
                      <label className="input input-bordered input-sm flex items-center gap-2">
                        <span className="text-base-content/50">🔍</span>
                        <input
                          type="text"
                          placeholder="Buscar..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="grow bg-transparent outline-none"
                        />
                      </label>
                    </div>

                    <ul className="max-h-64 overflow-y-auto p-2">
                      {loadingEmployees ? (
                        <li className="flex justify-center p-4">
                          <span className="loading loading-spinner loading-sm" />
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
                                onClick={() => handleEmployeeToggle(emp.id)}
                                className={`flex w-full items-center gap-2 rounded-lg p-2 transition-all ${
                                  isSelected ? "bg-primary/20 text-primary" : "hover:bg-base-200"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="checkbox checkbox-sm checkbox-primary"
                                />
                                <span className="truncate">{emp.full_name}</span>
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
          </div>

          {/* Generate Button */}
          <Button
            variant="primary"
            className="w-full"
            onClick={handleGenerateReport}
            disabled={!selectedMonth || selectedEmployeeIds.length === 0 || loading}
          >
            {loading ? "Generando..." : "Generar reporte"}
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-base-300 bg-base-100 rounded-xl border p-4">
            <div className="text-base-content/70 text-sm">Total de horas</div>
            <div className="text-primary mt-2 text-2xl font-bold">{stats.totalHours}</div>
          </div>
          <div className="border-base-300 bg-base-100 rounded-xl border p-4">
            <div className="text-base-content/70 text-sm">Promedio por empleado</div>
            <div className="text-base-content mt-2 text-2xl font-bold">{stats.averageHours}</div>
          </div>
          <div className="border-base-300 bg-base-100 rounded-xl border p-4">
            <div className="text-base-content/70 text-sm">Máximo</div>
            <div className="text-base-content mt-2 text-lg font-bold">{stats.maxEmployee.name}</div>
            <div className="text-base-content/60 text-sm">{stats.maxEmployee.hours} horas</div>
          </div>
          <div className="border-base-300 bg-base-100 rounded-xl border p-4">
            <div className="text-base-content/70 text-sm">Mínimo</div>
            <div className="text-base-content mt-2 text-lg font-bold">{stats.minEmployee.name}</div>
            <div className="text-base-content/60 text-sm">{stats.minEmployee.hours} horas</div>
          </div>
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="space-y-6">
          {/* Comparison Chart */}
          <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
            <h2 className="text-base-content mb-4 text-lg font-semibold">
              {granularity === "day" ? "Horas por día" : granularity === "week" ? "Horas por semana" : "Horas por mes"}
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              {granularity === "month" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis label={{ value: "Horas", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Legend />
                  {reportData.map((emp, idx) => (
                    <Bar
                      key={emp.employeeId}
                      dataKey={emp.fullName}
                      fill={chartColors[idx % chartColors.length]}
                      radius={[8, 8, 0, 0]}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis label={{ value: "Horas", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Legend />
                  {reportData.map((emp, idx) => (
                    <Line
                      key={emp.employeeId}
                      type="monotone"
                      dataKey={emp.fullName}
                      stroke={chartColors[idx % chartColors.length]}
                      strokeWidth={2}
                      connectNulls
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Distribution by Employee */}
          {reportData.length > 1 && (
            <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
              <h2 className="text-base-content mb-4 text-lg font-semibold">Distribución de horas</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reportData.map((emp) => ({
                      name: emp.fullName,
                      value: parseFloat((emp.totalMinutes / 60).toFixed(2)),
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}h`}
                    outerRadius={80}
                    fill="hsl(var(--p))"
                    dataKey="value"
                  >
                    {reportData.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={chartColors[idx % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed Table */}
          <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
            <h2 className="text-base-content mb-4 text-lg font-semibold">Detalle por empleado</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary/10 text-primary">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Empleado</th>
                    <th className="px-4 py-3 text-left font-semibold">Cargo</th>
                    <th className="px-4 py-3 text-right font-semibold">Horas</th>
                    <th className="px-4 py-3 text-right font-semibold">Horas extras</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((emp) => (
                    <tr key={emp.employeeId} className="border-base-300 odd:bg-base-200/30 border-b">
                      <td className="px-4 py-3 font-medium">{emp.fullName}</td>
                      <td className="text-base-content/70 px-4 py-3">{emp.role}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {parseFloat((emp.totalMinutes / 60).toFixed(2))}
                      </td>
                      <td className="text-warning px-4 py-3 text-right">
                        {parseFloat((emp.totalOvertimeMinutes / 60).toFixed(2))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {reportData.length === 0 && selectedEmployeeIds.length > 0 && !loading && (
        <div className="border-base-300 bg-base-100 rounded-2xl border p-12 text-center shadow-sm">
          <TrendingUp className="text-base-content/30 mx-auto mb-4 h-12 w-12" />
          <h3 className="text-base-content/70 text-lg font-semibold">Genera un reporte</h3>
          <p className="text-base-content/50 mt-1 text-sm">
            Haz clic en &quot;Generar reporte&quot; para ver los gráficos y estadísticas
          </p>
        </div>
      )}
    </section>
  );
}
