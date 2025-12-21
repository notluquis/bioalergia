/**
 * Lazy-loaded Chart Components for Reports
 * These are separated to enable code-splitting of Recharts (~400KB)
 */
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
import { BarChart2, PieChart as PieChartIcon } from "lucide-react";
import type { EmployeeWorkData, ReportGranularity } from "../types";
import { getChartColors } from "../utils/chartColors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartDataRecord = Record<string, any>;

interface TemporalChartProps {
  chartData: ChartDataRecord[];
  reportData: EmployeeWorkData[];
  granularity: ReportGranularity;
}

const tooltipStyle = {
  borderRadius: "12px",
  border: "none",
  boxShadow: "0 4px 6px -1px hsl(var(--b3) / 0.5)",
};

/**
 * Main temporal comparison chart (Bar or Line based on granularity)
 */
export function TemporalChart({ chartData, reportData, granularity }: TemporalChartProps) {
  const chartColors = getChartColors();

  return (
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
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--bc) / 0.05)" }} />
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
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--bc) / 0.05)" }} />
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
  );
}

interface DistributionChartProps {
  reportData: EmployeeWorkData[];
}

/**
 * Pie chart showing distribution of hours across employees
 */
export function DistributionChart({ reportData }: DistributionChartProps) {
  const chartColors = getChartColors();

  if (reportData.length <= 1) return null;

  const pieData = reportData.map((emp) => ({
    name: emp.fullName,
    value: parseFloat((emp.totalMinutes / 60).toFixed(1)),
  }));

  return (
    <div className="bg-base-100 border-base-200 rounded-3xl border p-6 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
        <PieChartIcon className="text-secondary h-5 w-5" />
        Distribución Total
      </h3>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="45%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
              {reportData.map((_, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={chartColors[idx % chartColors.length]}
                  stroke="hsl(var(--b1))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend verticalAlign="bottom" align="center" height={70} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Default export for lazy loading
export default { TemporalChart, DistributionChart };
