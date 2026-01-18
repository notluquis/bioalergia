/**
 * Lazy-loaded Chart Components for Reports
 * These are separated to enable code-splitting of Recharts (~400KB)
 */
import { BarChart2, PieChart as PieChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { EmployeeWorkData, ReportGranularity } from "../types";

import { getChartColors } from "../utils/chartColors";

/** Chart data record with period key and dynamic employee name keys */
type ChartDataRecord = Record<string, number | string>;

interface TemporalChartProps {
  chartData: ChartDataRecord[];
  granularity: ReportGranularity;
  reportData: EmployeeWorkData[];
}

const tooltipStyle = {
  border: "none",
  borderRadius: "12px",
  boxShadow: "0 4px 6px -1px hsl(var(--b3) / 0.5)",
};

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
    value: Number.parseFloat((emp.totalMinutes / 60).toFixed(1)),
  }));

  return (
    <div className="bg-base-100 border-base-200 rounded-3xl border p-6 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
        <PieChartIcon className="text-secondary h-5 w-5" />
        Distribución Total
      </h3>
      <div className="h-80 w-full">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart>
            <Pie cx="50%" cy="45%" data={pieData} dataKey="value" innerRadius={70} outerRadius={90} paddingAngle={5}>
              {reportData.map((_, idx) => (
                <Cell
                  fill={chartColors[idx % chartColors.length]}
                  key={`cell-${idx}`}
                  stroke="hsl(var(--b1))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend align="center" height={70} iconType="circle" verticalAlign="bottom" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Main temporal comparison chart (Bar or Line based on granularity)
 */
export function TemporalChart({ chartData, granularity, reportData }: TemporalChartProps) {
  const chartColors = getChartColors();

  return (
    <div className="bg-base-100 border-base-200 rounded-3xl border p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <BarChart2 className="text-primary h-5 w-5" />
          Comparativa Temporal
        </h3>
        <div className="badge badge-outline text-xs">
          {(() => {
            const labels: Record<string, string> = {
              day: "Diario",
              month: "Mensual",
              week: "Semanal",
            };
            return labels[granularity] || granularity;
          })()}
        </div>
      </div>

      <div className="w-full" style={{ height: 350, minHeight: 350 }}>
        <ResponsiveContainer height="100%" width="100%">
          {granularity === "month" ? (
            <BarChart data={chartData} margin={{ bottom: 0, left: 0, right: 10, top: 10 }}>
              <CartesianGrid opacity={0.3} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" stroke="hsl(var(--bc) / 0.4)" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--bc) / 0.4)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--bc) / 0.05)" }} />
              <Legend />
              {reportData.map((emp, idx) => (
                <Bar
                  dataKey={emp.fullName}
                  fill={chartColors[idx % chartColors.length]}
                  key={emp.employeeId}
                  maxBarSize={50}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={chartData} margin={{ bottom: 0, left: 0, right: 10, top: 10 }}>
              <CartesianGrid opacity={0.3} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" stroke="hsl(var(--bc) / 0.4)" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--bc) / 0.4)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--bc) / 0.05)" }} />
              <Legend iconType="circle" />
              {reportData.map((emp, idx) => (
                <Line
                  activeDot={{ r: 6 }}
                  connectNulls
                  dataKey={emp.fullName}
                  dot={{ r: 4, strokeWidth: 2 }}
                  key={emp.employeeId}
                  stroke={chartColors[idx % chartColors.length]}
                  strokeWidth={3}
                  type="monotone"
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Default export for lazy loading
export default { DistributionChart, TemporalChart };
