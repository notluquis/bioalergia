/**
 * Lazy-loaded Chart Components for Reports
 * These are separated to enable code-splitting of Recharts (~400KB)
 */
import { Chip } from "@heroui/react";
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

import { getChartColors } from "../utils/chart-colors";

/** Chart data record with period key and dynamic employee name keys */
type ChartDataRecord = Record<string, number | string>;

interface TemporalChartProps {
  chartData: ChartDataRecord[];
  granularity: ReportGranularity;
  reportData: EmployeeWorkData[];
}

const tooltipStyle = {
  backgroundColor: "var(--color-background)",
  border: "1px solid var(--default-200)",
  borderRadius: "12px",
  boxShadow: "0 10px 24px -18px rgb(0 0 0 / 0.45)",
  color: "var(--color-foreground)",
};

interface DistributionChartProps {
  reportData: EmployeeWorkData[];
}

/**
 * Pie chart showing distribution of hours across employees
 */
export function DistributionChart({ reportData }: DistributionChartProps) {
  const chartColors = getChartColors();

  if (reportData.length <= 1) {
    return null;
  }

  const pieData = reportData.map((emp) => ({
    name: emp.fullName,
    value: Number.parseFloat((emp.totalMinutes / 60).toFixed(1)),
  }));

  return (
    <div className="rounded-3xl border border-default-100 bg-background p-4 shadow-sm sm:p-6">
      <h3 className="mb-2 flex items-center gap-2 font-bold text-lg">
        <PieChartIcon className="h-5 w-5 text-secondary" />
        Distribución Total
      </h3>
      <div className="h-64 w-full sm:h-80">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart>
            <Pie
              cx="50%"
              cy="45%"
              data={pieData}
              dataKey="value"
              innerRadius={70}
              outerRadius={90}
              paddingAngle={5}
            >
              {reportData.map((_, idx) => (
                <Cell
                  fill={chartColors[idx % chartColors.length]}
                  // biome-ignore lint/suspicious/noArrayIndexKey: colors depend on index
                  key={`cell-${idx}`}
                  stroke="var(--default-200)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              align="center"
              height={70}
              iconSize={8}
              iconType="circle"
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: 11 }}
            />
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
    <div className="rounded-3xl border border-default-100 bg-background p-4 shadow-sm sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-lg">
          <BarChart2 className="h-5 w-5 text-primary" />
          Comparativa Temporal
        </h3>
        <Chip size="sm" variant="tertiary">
          {(() => {
            const labels: Record<string, string> = {
              day: "Diario",
              month: "Mensual",
              week: "Semanal",
            };
            return labels[granularity] || granularity;
          })()}
        </Chip>
      </div>

      <div className="h-64 w-full sm:h-[350px]">
        <ResponsiveContainer height="100%" width="100%">
          {granularity === "month" ? (
            <BarChart data={chartData} margin={{ bottom: 0, left: 0, right: 10, top: 10 }}>
              <CartesianGrid opacity={0.3} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" stroke="var(--default-400)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--default-400)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--default-100)" }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
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
              <XAxis dataKey="period" stroke="var(--default-400)" tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--default-400)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--default-100)" }} />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
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
