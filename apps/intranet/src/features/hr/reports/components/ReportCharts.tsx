/**
 * Lazy-loaded Chart Components for Reports
 * These are separated to enable code-splitting of Recharts (~400KB)
 */
import { Chip } from "@heroui/react";
import dayjs from "dayjs";
import { BarChart2, PieChart as PieChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
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

const compactClpFormatter = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  notation: "compact",
  style: "currency",
});

function formatSeriesLabel(rawName: string): string {
  if (rawName.endsWith("_gross")) {
    return `${rawName.replace("_gross", "")} · Bruto`;
  }
  if (rawName.endsWith("_net")) {
    return `${rawName.replace("_net", "")} · Neto`;
  }
  return `${rawName} · Horas`;
}

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
              shape={(props, idx) => (
                <Sector
                  {...props}
                  fill={chartColors[idx % chartColors.length]}
                  stroke="var(--default-200)"
                  strokeWidth={2}
                />
              )}
            />
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
 * Now supports dual Y-axis for hours and salary metrics
 */
export function TemporalChart({ chartData, granularity, reportData }: TemporalChartProps) {
  const chartColors = getChartColors();
  const hasSalaryData = reportData.some((emp) =>
    Object.values(emp.monthlyGrossSalary).some((value) => value > 0),
  );

  const formatHoursTick = (value: number | string) => `${value}h`;
  const formatSalaryTick = (value: number | string) => compactClpFormatter.format(Number(value));
  const formatPeriodLabel = (label: unknown) => {
    const value = typeof label === "string" || typeof label === "number" ? String(label) : "";
    return granularity === "month" && value ? dayjs(value).format("MMM YYYY") : value;
  };

  // Custom tooltip to show both hours and currency
  const CustomTooltip = (props: {
    active?: boolean;
    payload?: Array<{ color: string; name: string; payload?: { period?: string }; value: number }>;
  }) => {
    const { active, payload } = props;
    if (!active || !payload) {
      return null;
    }

    return (
      <div style={tooltipStyle} className="p-3">
        <p className="font-semibold text-xs">{payload[0]?.payload?.period}</p>
        {payload.map((entry, idx) => {
          const isSalary = entry.name.includes("_gross") || entry.name.includes("_net");
          const displayName = formatSeriesLabel(entry.name);

          return (
            <p key={`${entry.name}-${idx}`} style={{ color: entry.color }} className="text-xs">
              {displayName}:{" "}
              {isSalary ? formatSalaryTick(entry.value) : formatHoursTick(entry.value)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-default-100 bg-background p-4 shadow-sm sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-lg">
          <BarChart2 className="h-5 w-5 text-primary" />
          Comparativa Temporal
          {hasSalaryData && <span className="text-default-500 text-xs">(Horas y Salarios)</span>}
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

      <div className="h-64 w-full sm:h-87.5">
        <ResponsiveContainer height="100%" width="100%">
          {hasSalaryData && granularity === "month" ? (
            // Dual-axis chart for salary data (monthly view)
            <ComposedChart data={chartData} margin={{ bottom: 0, left: 0, right: 60, top: 10 }}>
              <CartesianGrid
                opacity={0.35}
                stroke="var(--default-200)"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                axisLine={{ stroke: "var(--default-300)" }}
                dataKey="period"
                minTickGap={24}
                stroke="var(--default-500)"
                tick={{ fill: "var(--default-500)", fontSize: 12 }}
                tickFormatter={formatPeriodLabel}
                tickLine={false}
              />

              {/* Left Y-axis for hours */}
              <YAxis
                allowDecimals={false}
                axisLine={{ stroke: "var(--default-300)" }}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                tickFormatter={formatHoursTick}
                tickLine={false}
                yAxisId="left"
                stroke="var(--default-500)"
                tick={{ fill: "var(--default-500)", fontSize: 12 }}
                label={{ value: "Horas", angle: -90, position: "insideLeft" }}
              />

              {/* Right Y-axis for salary (CLP) */}
              <YAxis
                allowDecimals={false}
                axisLine={{ stroke: "var(--default-300)" }}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                yAxisId="right"
                orientation="right"
                tickFormatter={formatSalaryTick}
                tickLine={false}
                stroke="var(--default-500)"
                tick={{ fill: "var(--default-500)", fontSize: 12 }}
                label={{ value: "CLP", angle: 90, position: "insideRight" }}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "var(--default-100)" }}
                labelFormatter={formatPeriodLabel}
              />
              <Legend
                formatter={(value) => formatSeriesLabel(String(value))}
                wrapperStyle={{ fontSize: 11 }}
                verticalAlign="bottom"
                height={48}
              />

              {/* Hours lines (left Y-axis) */}
              {reportData.map((emp, idx) => (
                <Line
                  key={`hours-${emp.employeeId}`}
                  yAxisId="left"
                  activeDot={{ r: 4 }}
                  connectNulls
                  dataKey={emp.fullName}
                  dot={{ r: 2, strokeWidth: 1.5 }}
                  stroke={chartColors[idx % chartColors.length]}
                  strokeWidth={2.2}
                  type="monotone"
                />
              ))}

              {/* Gross salary (right Y-axis) */}
              {reportData.map(
                (emp, idx) =>
                  Object.values(emp.monthlyGrossSalary).some((value) => value > 0) && (
                    <Line
                      key={`gross-${emp.employeeId}`}
                      yAxisId="right"
                      activeDot={{ r: 3 }}
                      connectNulls
                      dataKey={`${emp.fullName}_gross`}
                      dot={false}
                      stroke={chartColors[idx % chartColors.length]}
                      strokeWidth={1.8}
                      strokeDasharray="6 3"
                      type="monotone"
                      opacity={0.78}
                    />
                  ),
              )}

              {/* Net salary (right Y-axis) */}
              {reportData.map(
                (emp, idx) =>
                  Object.values(emp.monthlyNetSalary).some((value) => value > 0) && (
                    <Line
                      key={`net-${emp.employeeId}`}
                      yAxisId="right"
                      activeDot={{ r: 3 }}
                      connectNulls
                      dataKey={`${emp.fullName}_net`}
                      dot={false}
                      stroke={chartColors[idx % chartColors.length]}
                      strokeDasharray="2 4"
                      strokeWidth={1.8}
                      type="monotone"
                      opacity={0.62}
                    />
                  ),
              )}
            </ComposedChart>
          ) : granularity === "month" ? (
            // Standard bar chart for monthly view (no salary data)
            <BarChart data={chartData} margin={{ bottom: 0, left: 0, right: 10, top: 10 }}>
              <CartesianGrid
                opacity={0.35}
                stroke="var(--default-200)"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                axisLine={{ stroke: "var(--default-300)" }}
                dataKey="period"
                minTickGap={24}
                stroke="var(--default-500)"
                tick={{ fill: "var(--default-500)", fontSize: 12 }}
                tickFormatter={formatPeriodLabel}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                axisLine={{ stroke: "var(--default-300)" }}
                stroke="var(--default-500)"
                tick={{ fill: "var(--default-500)", fontSize: 12 }}
                tickFormatter={formatHoursTick}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--default-100)" }}
                formatter={(value) => formatHoursTick(Number(value))}
                labelFormatter={formatPeriodLabel}
              />
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
            // Line chart for daily/weekly view
            <LineChart data={chartData} margin={{ bottom: 0, left: 0, right: 10, top: 10 }}>
              <CartesianGrid
                opacity={0.35}
                stroke="var(--default-200)"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                axisLine={{ stroke: "var(--default-300)" }}
                dataKey="period"
                minTickGap={24}
                stroke="var(--default-500)"
                tick={{ fill: "var(--default-500)", fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                axisLine={{ stroke: "var(--default-300)" }}
                stroke="var(--default-500)"
                tick={{ fill: "var(--default-500)", fontSize: 12 }}
                tickFormatter={formatHoursTick}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--default-100)" }}
                formatter={(value) => formatHoursTick(Number(value))}
                labelFormatter={formatPeriodLabel}
              />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              {reportData.map((emp, idx) => (
                <Line
                  activeDot={{ r: 4 }}
                  connectNulls
                  dataKey={emp.fullName}
                  dot={{ r: 2, strokeWidth: 1.5 }}
                  key={emp.employeeId}
                  stroke={chartColors[idx % chartColors.length]}
                  strokeWidth={2.2}
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
